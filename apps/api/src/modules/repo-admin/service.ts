import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import {
  conversations,
  repoAdminConsents,
  repoHiddenConversations,
  repos,
  sessionDigests,
  users,
} from '@howicc/db/schema'
import type {
  RepoVisibility,
  RepoVisibilityPreviewItem,
} from '@howicc/contracts'
import type { ApiRuntime } from '../../runtime'
import { getRuntimeDatabase } from '../../lib/runtime-resources'

const CONSENT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours — consent expires daily
const REREVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days — repeat visit prompt

/**
 * Looks up the persisted repo row or returns the default (public) shape when
 * no admin has touched the repo yet.
 */
export const getRepoSettingsRow = async (
  runtime: ApiRuntime,
  owner: string,
  name: string,
): Promise<{
  visibility: RepoVisibility
  updatedByUserId?: string
  updatedAt?: Date
}> => {
  const db = getRuntimeDatabase(runtime)
  const rows = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)))
    .limit(1)

  const row = rows[0]
  if (!row) return { visibility: 'public' }
  return {
    visibility: row.visibility,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt,
  }
}

export const listHiddenConversationsForRepo = async (
  runtime: ApiRuntime,
  owner: string,
  name: string,
) => {
  const db = getRuntimeDatabase(runtime)

  const hidden = await db
    .select({
      conversationId: repoHiddenConversations.conversationId,
      hiddenBy: repoHiddenConversations.hiddenByUserId,
      hiddenAt: repoHiddenConversations.hiddenAt,
    })
    .from(repoHiddenConversations)
    .where(
      and(
        eq(repoHiddenConversations.owner, owner),
        eq(repoHiddenConversations.name, name),
      ),
    )

  if (!hidden.length) return []

  const ids = hidden.map(h => h.conversationId)
  const convoRows = await db
    .select({
      conv: conversations,
      ownerName: users.name,
    })
    .from(conversations)
    .leftJoin(users, eq(users.id, conversations.ownerUserId))
    .where(inArray(conversations.id, ids))

  const byId = new Map(convoRows.map(r => [r.conv.id, r]))

  return hidden
    .map(h => {
      const row = byId.get(h.conversationId)
      if (!row) return null
      return {
        conversationId: row.conv.id,
        slug: row.conv.slug,
        title: row.conv.title,
        visibility: row.conv.visibility,
        ownerUserId: row.conv.ownerUserId,
        ownerName: row.ownerName ?? undefined,
        hiddenBy: h.hiddenBy,
        hiddenAt: h.hiddenAt.toISOString(),
      }
    })
    .filter((x): x is Exclude<typeof x, null> => x !== null)
}

export const consentIsFresh = async (
  runtime: ApiRuntime,
  params: { owner: string; name: string; userId: string; now?: Date },
): Promise<{ fresh: boolean; consentedAt?: Date }> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()

  const currentSettings = await getRepoSettingsRow(runtime, params.owner, params.name)

  const rows = await db
    .select()
    .from(repoAdminConsents)
    .where(
      and(
        eq(repoAdminConsents.owner, params.owner),
        eq(repoAdminConsents.name, params.name),
        eq(repoAdminConsents.userId, params.userId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return { fresh: false }

  // Consent is invalidated if visibility changed since it was granted.
  if (row.visibilityAtConsent !== currentSettings.visibility) {
    return { fresh: false, consentedAt: row.consentedAt }
  }

  // Daily rolling expiry for mutating actions.
  const age = now.getTime() - row.consentedAt.getTime()
  if (age > CONSENT_TTL_MS) {
    return { fresh: false, consentedAt: row.consentedAt }
  }

  return { fresh: true, consentedAt: row.consentedAt }
}

/**
 * Looser check used to decide whether the settings page should render the
 * acknowledgement modal. If the repo is private AND the admin has not
 * consented within the last 30 days, we ask them to re-acknowledge.
 */
export const consentShouldBeRequested = async (
  runtime: ApiRuntime,
  params: { owner: string; name: string; userId: string; now?: Date },
): Promise<boolean> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()
  const currentSettings = await getRepoSettingsRow(runtime, params.owner, params.name)

  if (currentSettings.visibility !== 'private') return false

  const rows = await db
    .select({ consentedAt: repoAdminConsents.consentedAt })
    .from(repoAdminConsents)
    .where(
      and(
        eq(repoAdminConsents.owner, params.owner),
        eq(repoAdminConsents.name, params.name),
        eq(repoAdminConsents.userId, params.userId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return true
  return now.getTime() - row.consentedAt.getTime() > REREVIEW_WINDOW_MS
}

export const recordConsent = async (
  runtime: ApiRuntime,
  params: { owner: string; name: string; userId: string; now?: Date },
): Promise<Date> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()
  const currentSettings = await getRepoSettingsRow(runtime, params.owner, params.name)

  await db
    .insert(repoAdminConsents)
    .values({
      owner: params.owner,
      name: params.name,
      userId: params.userId,
      consentedAt: now,
      visibilityAtConsent: currentSettings.visibility,
    })
    .onConflictDoUpdate({
      target: [
        repoAdminConsents.owner,
        repoAdminConsents.name,
        repoAdminConsents.userId,
      ],
      set: {
        consentedAt: now,
        visibilityAtConsent: currentSettings.visibility,
      },
    })

  return now
}

/**
 * Lists the public + unlisted conversations that would be aggregated on the
 * repo page at the supplied target visibility. Always ignores hidden
 * conversations (admin already chose to hide them; visibility change cannot
 * revive them automatically).
 */
export const previewAggregatedConversations = async (
  runtime: ApiRuntime,
  params: { owner: string; name: string; target: RepoVisibility },
): Promise<RepoVisibilityPreviewItem[]> => {
  const db = getRuntimeDatabase(runtime)
  const fullName = `${params.owner}/${params.name}`

  if (params.target === 'private') return []

  const hidden = await db
    .select({ conversationId: repoHiddenConversations.conversationId })
    .from(repoHiddenConversations)
    .where(
      and(
        eq(repoHiddenConversations.owner, params.owner),
        eq(repoHiddenConversations.name, params.name),
      ),
    )

  const hiddenIds = new Set(hidden.map(h => h.conversationId))

  const rows = await db
    .select({
      conv: conversations,
      digest: sessionDigests,
      ownerName: users.name,
    })
    .from(conversations)
    .innerJoin(
      sessionDigests,
      and(
        eq(sessionDigests.conversationId, conversations.id),
        eq(sessionDigests.revisionId, conversations.currentRevisionId),
      ),
    )
    .leftJoin(users, eq(users.id, conversations.ownerUserId))
    .where(
      and(
        eq(sessionDigests.repository, fullName),
        ne(conversations.visibility, 'private'),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(200)

  return rows
    .filter(r => !hiddenIds.has(r.conv.id))
    .map(r => ({
      conversationId: r.conv.id,
      slug: r.conv.slug,
      title: r.conv.title,
      visibility: r.conv.visibility,
      ownerUserId: r.conv.ownerUserId,
      ownerName: r.ownerName ?? undefined,
      sessionCreatedAt: r.conv.createdAt.toISOString(),
    }))
}

// ─── Preview token (HMAC signed, 10 min TTL) ─────────────────────────────
const TOKEN_TTL_MS = 10 * 60 * 1000

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - (text.length % 4)) % 4)
  const binary =
    typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const hmacKeyFromSecret = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

type PreviewTokenPayload = {
  o: string
  n: string
  t: RepoVisibility
  u: string
  e: number // expiresAt ms epoch
}

export const signPreviewToken = async (
  secret: string,
  params: {
    owner: string
    name: string
    target: RepoVisibility
    userId: string
    now?: Date
  },
): Promise<string> => {
  const expires = (params.now ?? new Date()).getTime() + TOKEN_TTL_MS
  const payload: PreviewTokenPayload = {
    o: params.owner,
    n: params.name,
    t: params.target,
    u: params.userId,
    e: expires,
  }
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await hmacKeyFromSecret(secret)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encoded),
  )
  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`
}

export const verifyPreviewToken = async (
  secret: string,
  token: string,
  expected: {
    owner: string
    name: string
    target: RepoVisibility
    userId: string
    now?: Date
  },
): Promise<boolean> => {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return false

  const key = await hmacKeyFromSecret(secret)
  const sigBytes = fromBase64Url(signature)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes.slice().buffer,
    new TextEncoder().encode(encoded),
  )
  if (!valid) return false

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encoded)),
    ) as PreviewTokenPayload
    const now = (expected.now ?? new Date()).getTime()
    if (payload.e < now) return false
    if (payload.o !== expected.owner) return false
    if (payload.n !== expected.name) return false
    if (payload.t !== expected.target) return false
    if (payload.u !== expected.userId) return false
    return true
  } catch {
    return false
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────

export const upsertRepoVisibility = async (
  runtime: ApiRuntime,
  params: {
    owner: string
    name: string
    visibility: RepoVisibility
    userId: string
    now?: Date
  },
): Promise<Date> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()

  await db
    .insert(repos)
    .values({
      owner: params.owner,
      name: params.name,
      visibility: params.visibility,
      updatedByUserId: params.userId,
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [repos.owner, repos.name],
      set: {
        visibility: params.visibility,
        updatedByUserId: params.userId,
        updatedAt: now,
      },
    })

  // Invalidate OTHER admins' consent so they have to re-acknowledge the new
  // visibility. Keep the caller's consent fresh — they just set it.
  await db
    .delete(repoAdminConsents)
    .where(
      and(
        eq(repoAdminConsents.owner, params.owner),
        eq(repoAdminConsents.name, params.name),
        ne(repoAdminConsents.userId, params.userId),
      ),
    )

  await db
    .update(repoAdminConsents)
    .set({
      consentedAt: now,
      visibilityAtConsent: params.visibility,
    })
    .where(
      and(
        eq(repoAdminConsents.owner, params.owner),
        eq(repoAdminConsents.name, params.name),
        eq(repoAdminConsents.userId, params.userId),
      ),
    )

  return now
}

export const hideConversationFromRepo = async (
  runtime: ApiRuntime,
  params: {
    owner: string
    name: string
    conversationId: string
    userId: string
    now?: Date
  },
): Promise<{ found: boolean; hiddenAt: Date | null }> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()
  const fullName = `${params.owner}/${params.name}`

  const digestRow = await db
    .select({
      conversationId: sessionDigests.conversationId,
    })
    .from(sessionDigests)
    .innerJoin(conversations, eq(conversations.id, sessionDigests.conversationId))
    .where(
      and(
        eq(sessionDigests.repository, fullName),
        eq(sessionDigests.conversationId, params.conversationId),
        eq(sessionDigests.revisionId, conversations.currentRevisionId),
      ),
    )
    .limit(1)

  if (!digestRow[0]) return { found: false, hiddenAt: null }

  await db
    .insert(repoHiddenConversations)
    .values({
      owner: params.owner,
      name: params.name,
      conversationId: params.conversationId,
      hiddenByUserId: params.userId,
      hiddenAt: now,
    })
    .onConflictDoUpdate({
      target: [
        repoHiddenConversations.owner,
        repoHiddenConversations.name,
        repoHiddenConversations.conversationId,
      ],
      set: {
        hiddenByUserId: params.userId,
        hiddenAt: now,
      },
    })

  return { found: true, hiddenAt: now }
}

export const unhideConversationFromRepo = async (
  runtime: ApiRuntime,
  params: {
    owner: string
    name: string
    conversationId: string
  },
): Promise<boolean> => {
  const db = getRuntimeDatabase(runtime)
  const result = await db
    .delete(repoHiddenConversations)
    .where(
      and(
        eq(repoHiddenConversations.owner, params.owner),
        eq(repoHiddenConversations.name, params.name),
        eq(repoHiddenConversations.conversationId, params.conversationId),
      ),
    )
  // drizzle-orm doesn't report affected rows in a portable way; check if it
  // still exists afterwards.
  const stillThere = await db
    .select({ id: sql<number>`1` })
    .from(repoHiddenConversations)
    .where(
      and(
        eq(repoHiddenConversations.owner, params.owner),
        eq(repoHiddenConversations.name, params.name),
        eq(repoHiddenConversations.conversationId, params.conversationId),
      ),
    )
    .limit(1)
  void result
  return stillThere.length === 0
}
