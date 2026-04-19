import { and, desc, eq } from 'drizzle-orm'
import { apiTokens } from '@howicc/db/schema'
import type { ApiRuntime } from '../../runtime'
import { ApiError } from '../../lib/api-error'
import { sha256Hex } from '../../lib/cli-token-auth'
import { getRuntimeDatabase } from '../../lib/runtime-resources'

/**
 * Shape returned to clients for every API token row.
 *
 * Never includes the plaintext secret — that's only available in the
 * response of `createUserApiToken`, which returns it alongside the
 * summary. The database only ever stores a SHA-256 hash.
 */
export type ApiTokenSummary = {
  id: string
  tokenPrefix: string
  createdAt: string
  revokedAt?: string
}

/**
 * Newest-first list of the caller's tokens, including revoked ones so
 * the settings UI can render audit history alongside active tokens.
 */
export const listUserApiTokens = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<ApiTokenSummary[]> => {
  const db = getRuntimeDatabase(runtime)

  const rows = await db
    .select({
      id: apiTokens.id,
      tokenPrefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt))

  return rows.map((row) => ({
    id: row.id,
    tokenPrefix: row.tokenPrefix,
    createdAt: new Date(row.createdAt).toISOString(),
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : undefined,
  }))
}

const mintToken = () =>
  `hwi_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`

const mintTokenId = () =>
  `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/**
 * Generates a new `hwi_*` bearer token for the given user, persists its
 * SHA-256 hash, and returns the plaintext secret alongside the summary.
 *
 * The secret is the only bit of this response the caller can never get
 * back — the UI must show it to the user once and then drop the value.
 *
 * @example
 * const { token, secret } = await createUserApiToken(runtime, user.id)
 */
export const createUserApiToken = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<{ token: ApiTokenSummary; secret: string }> => {
  const db = getRuntimeDatabase(runtime)
  const secret = mintToken()
  const id = mintTokenId()
  const tokenPrefix = secret.slice(0, 12)
  const tokenHash = await sha256Hex(secret)
  const createdAt = new Date()

  await db.insert(apiTokens).values({
    id,
    userId,
    tokenPrefix,
    tokenHash,
    createdAt,
    revokedAt: null,
  })

  return {
    secret,
    token: {
      id,
      tokenPrefix,
      createdAt: createdAt.toISOString(),
    },
  }
}

/**
 * Revokes one of the caller's tokens by id. "Not found" and "not yours"
 * both return `null` so the route layer can answer 404 uniformly —
 * non-owners can't probe for valid token ids.
 */
export const revokeUserApiToken = async (
  runtime: ApiRuntime,
  userId: string,
  tokenId: string,
): Promise<{ id: string; revokedAt: string } | null> => {
  const db = getRuntimeDatabase(runtime)

  const rows = await db
    .select({ id: apiTokens.id, revokedAt: apiTokens.revokedAt })
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .limit(1)

  const existing = rows[0]
  if (!existing) return null

  if (existing.revokedAt) {
    return {
      id: existing.id,
      revokedAt: new Date(existing.revokedAt).toISOString(),
    }
  }

  const revokedAt = new Date()
  await db
    .update(apiTokens)
    .set({ revokedAt })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))

  return {
    id: existing.id,
    revokedAt: revokedAt.toISOString(),
  }
}

/**
 * Helper that resolves an authenticated user id from either a CLI bearer
 * token or a Better Auth session cookie. Throws `authRequired` so route
 * handlers can let the error bubble up.
 */
export const ensureAuthenticatedUserId = (
  userId: string | null,
): string => {
  if (!userId) {
    throw new ApiError('authRequired', 'Authentication required.')
  }
  return userId
}
