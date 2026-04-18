import { and, eq, lt, sql } from 'drizzle-orm'
import { sessionDigests, userProfiles, conversations } from '@howicc/db/schema'
import type {
  ProviderId,
  SessionDigest,
  SessionType,
  UserProfile,
} from '@howicc/canonical'
import { buildUserProfile } from '@howicc/profile'
import type { ApiRuntime } from '../../runtime'
import { getRuntimeDatabase } from '../../lib/runtime-resources'

const currentRevisionJoin = and(
  eq(sessionDigests.conversationId, conversations.id),
  eq(sessionDigests.revisionId, conversations.currentRevisionId),
)

export const upsertSessionDigest = async (
  runtime: ApiRuntime,
  params: {
    id: string
    conversationId: string
    revisionId: string
    ownerUserId: string
    digest: SessionDigest
  },
) => {
  const db = getRuntimeDatabase(runtime)
  const repository = params.digest.repository?.fullName ?? null

  await db
    .insert(sessionDigests)
    .values({
      id: params.id,
      conversationId: params.conversationId,
      revisionId: params.revisionId,
      ownerUserId: params.ownerUserId,
      provider: params.digest.provider,
      projectKey: params.digest.projectKey,
      repository,
      digestJson: JSON.stringify(params.digest),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sessionDigests.conversationId, sessionDigests.revisionId],
      set: {
        provider: params.digest.provider,
        projectKey: params.digest.projectKey,
        repository,
        digestJson: JSON.stringify(params.digest),
        createdAt: new Date(),
      },
    })
}

export const getUserProfile = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<UserProfile | null> => {
  const db = getRuntimeDatabase(runtime)

  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return JSON.parse(row.profileJson) as UserProfile
}

export const recomputeUserProfile = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<UserProfile> => {
  const db = getRuntimeDatabase(runtime)

  // Read only current digests so re-sync revisions do not inflate the profile.
  const digestRows = await db
    .select({ digestJson: sessionDigests.digestJson })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(eq(sessionDigests.ownerUserId, userId))

  const digests = digestRows.map(row => JSON.parse(row.digestJson) as SessionDigest)

  const profile = buildUserProfile(userId, digests)

  // Upsert the materialized profile
  await db
    .insert(userProfiles)
    .values({
      userId,
      profileJson: JSON.stringify(profile),
      digestCount: digests.length,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        profileJson: JSON.stringify(profile),
        digestCount: digests.length,
        updatedAt: new Date(),
      },
    })

  return profile
}

export const getOrComputeUserProfile = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<UserProfile> => {
  const db = getRuntimeDatabase(runtime)

  // Check if materialized profile exists and is up to date
  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  const existing = profileRows[0]

  // Count current digests
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(eq(sessionDigests.ownerUserId, userId))

  const currentDigestCount = countResult[0]?.count ?? 0

  // If profile exists and digest count matches, return cached
  if (existing && existing.digestCount === currentDigestCount && currentDigestCount > 0) {
    return JSON.parse(existing.profileJson) as UserProfile
  }

  // Otherwise recompute
  return recomputeUserProfile(runtime, userId)
}

export const getDigestCount = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<number> => {
  const db = getRuntimeDatabase(runtime)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(eq(sessionDigests.ownerUserId, userId))

  return result[0]?.count ?? 0
}

export type ProfileStats = {
  digestCount: number
  totalSessions: number
  totalDurationMs: number
  totalCostUsd: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  firstSessionAt?: string
  lastSessionAt?: string
}

/**
 * Lightweight header stats derived from the materialized UserProfile.
 *
 * Used by dashboards that only need a handful of aggregates — reading the
 * cached profile and cherry-picking fields avoids serializing the full
 * profile JSON (~100–500 KB) over the wire.
 *
 * @example
 * const stats = await getUserProfileStats(runtime, userId)
 */
export const getUserProfileStats = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<ProfileStats | null> => {
  const digestCount = await getDigestCount(runtime, userId)
  if (digestCount === 0) return null

  const profile = await getOrComputeUserProfile(runtime, userId)

  return {
    digestCount: profile.digestCount,
    totalSessions: profile.activity.totalSessions,
    totalDurationMs: profile.activity.totalDurationMs,
    totalCostUsd: profile.cost.totalUsd,
    activeDays: profile.activity.activeDays,
    currentStreak: profile.activity.currentStreak,
    longestStreak: profile.activity.longestStreak,
    firstSessionAt: profile.activity.firstSessionAt,
    lastSessionAt: profile.activity.lastSessionAt,
  }
}

export type ProfileActivityItem = {
  conversationId: string
  slug: string
  title: string
  visibility: 'private' | 'unlisted' | 'public'
  provider: ProviderId
  projectKey: string
  projectPath?: string
  sessionCreatedAt: string
  syncedAt: string
  durationMs?: number
  estimatedCostUsd?: number
  toolRunCount: number
  turnCount: number
  messageCount: number
  sessionType: SessionType
  hasPlan: boolean
  models: string[]
  repository: { fullName: string; source: 'git_remote' | 'pr_link' | 'cwd_derived' } | null
}

export type ProfileActivityPage = {
  items: ProfileActivityItem[]
  nextCursor?: string
  total: number
}

export const DEFAULT_ACTIVITY_LIMIT = 20
export const MAX_ACTIVITY_LIMIT = 50

/**
 * Cursor-paginated activity feed for the authenticated user.
 *
 * Sorts by the digest's `createdAt` (ingestion time), newest first, so
 * freshly synced sessions surface at the top. The cursor is the previous
 * page's oldest `syncedAt` — items strictly before it are returned next.
 *
 * @example
 * const firstPage = await listUserProfileActivity(runtime, userId, { limit: 20 })
 * const secondPage = await listUserProfileActivity(runtime, userId, {
 *   limit: 20,
 *   cursor: firstPage.nextCursor,
 * })
 */
export const listUserProfileActivity = async (
  runtime: ApiRuntime,
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ProfileActivityPage> => {
  const db = getRuntimeDatabase(runtime)
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_ACTIVITY_LIMIT, 1),
    MAX_ACTIVITY_LIMIT,
  )

  const cursorDate = options.cursor ? new Date(options.cursor) : null
  const cursorValid = cursorDate && !Number.isNaN(cursorDate.valueOf())

  const ownerFilter = eq(sessionDigests.ownerUserId, userId)
  const whereClause = cursorValid
    ? and(ownerFilter, lt(sessionDigests.createdAt, cursorDate))
    : ownerFilter

  const rows = await db
    .select({
      conversationId: sessionDigests.conversationId,
      digestJson: sessionDigests.digestJson,
      digestCreatedAt: sessionDigests.createdAt,
      conversationSlug: conversations.slug,
      conversationTitle: conversations.title,
      conversationVisibility: conversations.visibility,
    })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(whereClause)
    .orderBy(sql`${sessionDigests.createdAt} desc`)
    .limit(limit + 1)

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(ownerFilter)
  const total = totalResult[0]?.count ?? 0

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const items: ProfileActivityItem[] = pageRows.map(row => {
    const digest = JSON.parse(row.digestJson) as SessionDigest
    const syncedAt = new Date(row.digestCreatedAt).toISOString()

    return {
      conversationId: row.conversationId,
      slug: row.conversationSlug,
      title: row.conversationTitle,
      visibility: row.conversationVisibility,
      provider: digest.provider,
      projectKey: digest.projectKey,
      projectPath: digest.projectPath,
      sessionCreatedAt: digest.createdAt,
      syncedAt,
      durationMs: digest.durationMs,
      estimatedCostUsd: digest.estimatedCostUsd,
      toolRunCount: digest.toolRunCount,
      turnCount: digest.turnCount,
      messageCount: digest.messageCount,
      sessionType: digest.sessionType,
      hasPlan: digest.hasPlan,
      models: digest.models.map(model => model.model),
      repository: digest.repository
        ? { fullName: digest.repository.fullName, source: digest.repository.source }
        : null,
    }
  })

  const nextCursor = hasMore
    ? new Date(pageRows[pageRows.length - 1]!.digestCreatedAt).toISOString()
    : undefined

  return { items, nextCursor, total }
}

// ---------------------------------------------------------------------------
// Repository-level aggregation (cross-user)
// ---------------------------------------------------------------------------

export type RepoProfile = UserProfile & {
  repository: string
  contributorCount: number
  contributors: Array<{ userId: string; name?: string; sessionCount: number }>
}

export const getRepoProfile = async (
  runtime: ApiRuntime,
  repositoryFullName: string,
): Promise<RepoProfile | null> => {
  const db = getRuntimeDatabase(runtime)

  // Get public digests for this repo, limited to prevent OOM on popular repos
  const MAX_REPO_DIGESTS = 500

  const rows = await db
    .select({
      digestJson: sessionDigests.digestJson,
      ownerUserId: sessionDigests.ownerUserId,
    })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(
      and(
        eq(sessionDigests.repository, repositoryFullName),
        eq(conversations.visibility, 'public'),
      ),
    )
    .limit(MAX_REPO_DIGESTS)

  if (rows.length === 0) return null

  const digests = rows.map(row => JSON.parse(row.digestJson) as SessionDigest)

  // Build the repo-wide profile using the same aggregator
  const profile = buildUserProfile(`repo:${repositoryFullName}`, digests)

  // Count unique contributors
  const contributorMap = new Map<string, number>()
  for (const row of rows) {
    contributorMap.set(row.ownerUserId, (contributorMap.get(row.ownerUserId) ?? 0) + 1)
  }

  const contributors = [...contributorMap.entries()]
    .map(([userId, sessionCount]) => ({ userId, sessionCount }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  return {
    ...profile,
    repository: repositoryFullName,
    contributorCount: contributors.length,
    contributors,
  }
}

export const getPublicRepoDigestCount = async (
  runtime: ApiRuntime,
  repositoryFullName: string,
): Promise<number> => {
  const db = getRuntimeDatabase(runtime)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionDigests)
    .innerJoin(conversations, currentRevisionJoin)
    .where(
      and(
        eq(sessionDigests.repository, repositoryFullName),
        eq(conversations.visibility, 'public'),
      ),
    )

  return result[0]?.count ?? 0
}
