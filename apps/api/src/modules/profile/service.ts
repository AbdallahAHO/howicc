import { and, eq, sql } from 'drizzle-orm'
import { sessionDigests, userProfiles, conversations } from '@howicc/db/schema'
import type { SessionDigest, UserProfile } from '@howicc/canonical'
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
