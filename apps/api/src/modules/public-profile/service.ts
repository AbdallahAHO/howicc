import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  accounts,
  conversations,
  conversationViews,
  profileViews,
  sessionDigests,
  users,
} from '@howicc/db/schema'
import type {
  PublicProfileActivity,
  PublicProfileBadge,
  PublicProfileMineResponse,
  PublicProfileResponse,
  PublicProfileSessionCard,
  PublicProfileSettings,
  UpdatePublicProfileSettingsRequest,
} from '@howicc/contracts'
import type {
  SessionDigest,
  SessionType,
  UserProfile,
} from '@howicc/canonical'
import { buildUserProfile } from '@howicc/profile'
import type { ApiRuntime } from '../../runtime'
import { getRuntimeDatabase } from '../../lib/runtime-resources'

const DEFAULT_SETTINGS: PublicProfileSettings = {
  showActivityHeatmap: true,
  showCost: false,
  showRepositories: true,
  showSessionTypes: true,
  showToolsLanguages: true,
  showBadges: true,
}

export const getDefaultPublicProfileSettings = (): PublicProfileSettings => ({
  ...DEFAULT_SETTINGS,
})

const parseSettings = (raw: unknown): PublicProfileSettings => {
  if (!raw || typeof raw !== 'object') return getDefaultPublicProfileSettings()
  const record = raw as Record<string, unknown>
  const merged: PublicProfileSettings = {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(record).filter(
        ([key, value]) =>
          typeof value === 'boolean' && key in DEFAULT_SETTINGS,
      ),
    ),
  }
  return merged
}

export const findUserByUsername = async (
  runtime: ApiRuntime,
  username: string,
) => {
  const db = getRuntimeDatabase(runtime)
  const lowered = username.toLowerCase()
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${lowered}`)
    .limit(1)
  return rows[0] ?? null
}

const deriveBadges = (profile: UserProfile): PublicProfileBadge[] => {
  const badges: PublicProfileBadge[] = []

  const sessionTypeEntries = Object.entries(
    profile.productivity.sessionTypeDistribution,
  ) as Array<[SessionType, number]>
  const topType = sessionTypeEntries.sort((a, b) => b[1] - a[1])[0]
  if (topType && topType[1] > 0) {
    const labels: Record<SessionType, string> = {
      building: 'Builder',
      debugging: 'Debugger',
      exploring: 'Explorer',
      investigating: 'Investigator',
      mixed: 'Generalist',
    }
    badges.push({
      id: topType[0],
      label: labels[topType[0]],
      description: `${Math.round(
        (topType[1] / Math.max(profile.digestCount, 1)) * 100,
      )}% of sessions are ${topType[0]}.`,
    })
  }

  const peakHourIndex = profile.activity.hourlyDistribution.indexOf(
    Math.max(...profile.activity.hourlyDistribution),
  )
  if (peakHourIndex >= 0 && profile.activity.totalSessions > 0) {
    if (peakHourIndex >= 22 || peakHourIndex <= 3) {
      badges.push({
        id: 'night_owl',
        label: 'Night owl',
        description: 'Most active between 10pm and 4am.',
      })
    } else if (peakHourIndex >= 5 && peakHourIndex <= 9) {
      badges.push({
        id: 'early_bird',
        label: 'Early bird',
        description: 'Most active before 10am.',
      })
    }
  }

  if (profile.activity.currentStreak >= 7) {
    badges.push({
      id: 'streaker',
      label: `${profile.activity.currentStreak}-day streak`,
      description: 'Synced sessions every day this week.',
    })
  }

  if (profile.activity.totalSessions >= 50) {
    badges.push({
      id: 'prolific',
      label: 'Prolific',
      description: `${profile.activity.totalSessions.toLocaleString()} synced sessions.`,
    })
  }

  return badges
}

const filterProfileByFlags = (
  profile: UserProfile,
  settings: PublicProfileSettings,
): {
  activity?: PublicProfileActivity
  sessionTypes?: Record<string, number>
  languages?: Record<string, number>
  topTools?: Array<{ name: string; count: number }>
  publicRepos?: Array<{ fullName: string; sessionCount: number }>
  cost?: { totalUsd: number }
  badges?: PublicProfileBadge[]
} => {
  const result: ReturnType<typeof filterProfileByFlags> = {}

  if (settings.showActivityHeatmap) {
    result.activity = {
      dailyActivity: profile.activity.dailyActivity.map(d => ({
        date: d.date,
        sessionCount: d.sessionCount,
      })),
      hourlyDistribution: profile.activity.hourlyDistribution,
      weekdayDistribution: profile.activity.weekdayDistribution,
    }
  }

  if (settings.showSessionTypes) {
    result.sessionTypes = profile.productivity.sessionTypeDistribution as Record<
      string,
      number
    >
  }

  if (settings.showToolsLanguages) {
    result.languages = profile.productivity.languages
    result.topTools = profile.toolcraft.topCommands
      .slice(0, 10)
      .map(c => ({ name: c.name, count: c.totalInvocations }))
  }

  if (settings.showRepositories) {
    const repoMap = new Map<string, number>()
    for (const project of profile.projects) {
      const full = project.repository?.fullName
      if (!full) continue
      repoMap.set(full, (repoMap.get(full) ?? 0) + project.sessionCount)
    }
    result.publicRepos = Array.from(repoMap.entries())
      .map(([fullName, sessionCount]) => ({ fullName, sessionCount }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
  }

  if (settings.showCost) {
    result.cost = { totalUsd: profile.cost.totalUsd }
  }

  if (settings.showBadges) {
    result.badges = deriveBadges(profile)
  }

  return result
}

const mapDigestToCard = (
  conversation: typeof conversations.$inferSelect,
  digest: SessionDigest,
  viewCount: number,
): PublicProfileSessionCard => ({
  conversationId: conversation.id,
  slug: conversation.slug,
  title: conversation.title,
  provider: digest.provider,
  sessionType: digest.sessionType,
  projectKey: digest.projectKey,
  repository: digest.repository?.fullName,
  messageCount: digest.messageCount,
  toolRunCount: digest.toolRunCount,
  durationMs: digest.durationMs,
  viewCount,
  sessionCreatedAt: digest.createdAt,
})

export const getPublicProfile = async (
  runtime: ApiRuntime,
  username: string,
): Promise<PublicProfileResponse | null> => {
  const db = getRuntimeDatabase(runtime)
  const user = await findUserByUsername(runtime, username)
  if (!user || !user.publicProfileEnabled) return null

  const settings = parseSettings(user.publicProfileSettings)

  const publicDigestRows = await db
    .select({ digestJson: sessionDigests.digestJson })
    .from(conversations)
    .innerJoin(
      sessionDigests,
      and(
        eq(sessionDigests.conversationId, conversations.id),
        eq(sessionDigests.revisionId, conversations.currentRevisionId),
      ),
    )
    .where(
      and(
        eq(conversations.ownerUserId, user.id),
        eq(conversations.visibility, 'public'),
      ),
    )

  const publicProfile = publicDigestRows.length
    ? buildUserProfile(
        user.id,
        publicDigestRows.map(row => JSON.parse(row.digestJson) as SessionDigest),
      )
    : null

  const githubAccount = await db
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'github')))
    .limit(1)

  const stats = publicProfile
    ? {
        sessionCount: publicProfile.activity.totalSessions,
        totalDurationMs: publicProfile.activity.totalDurationMs,
        activeDays: publicProfile.activity.activeDays,
        currentStreak: publicProfile.activity.currentStreak,
        longestStreak: publicProfile.activity.longestStreak,
        firstSessionAt: publicProfile.activity.firstSessionAt,
        lastSessionAt: publicProfile.activity.lastSessionAt,
      }
    : {
        sessionCount: 0,
        totalDurationMs: 0,
        activeDays: 0,
        currentStreak: 0,
        longestStreak: 0,
      }

  const filtered = publicProfile
    ? filterProfileByFlags(publicProfile, settings)
    : settings.showBadges
      ? { badges: [] as PublicProfileBadge[] }
      : {}

  const publicConversationRows = await db
    .select({
      conv: conversations,
      digest: sessionDigests,
    })
    .from(conversations)
    .innerJoin(
      sessionDigests,
      and(
        eq(sessionDigests.conversationId, conversations.id),
        eq(sessionDigests.revisionId, conversations.currentRevisionId),
      ),
    )
    .where(
      and(
        eq(conversations.ownerUserId, user.id),
        eq(conversations.visibility, 'public'),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(12)

  const conversationIds = publicConversationRows.map(r => r.conv.id)

  const viewCounts = conversationIds.length
    ? await db
        .select({
          conversationId: conversationViews.conversationId,
          count: sql<number>`count(*)`,
        })
        .from(conversationViews)
        .where(inArray(conversationViews.conversationId, conversationIds))
        .groupBy(conversationViews.conversationId)
    : []

  const viewCountByConversation = new Map<string, number>(
    viewCounts.map(v => [v.conversationId, Number(v.count)]),
  )

  const publicSessions: PublicProfileSessionCard[] = publicConversationRows.map(
    row => {
      const digest = JSON.parse(row.digest.digestJson) as SessionDigest
      return mapDigestToCard(
        row.conv,
        digest,
        viewCountByConversation.get(row.conv.id) ?? 0,
      )
    },
  )

  const githubLogin = githubAccount[0]?.accountId
    ? undefined
    : undefined

  return {
    success: true as const,
    user: {
      username: user.username,
      displayName: user.name,
      avatarUrl: user.image ?? undefined,
      githubUrl: `https://github.com/${user.username}`,
      websiteUrl: user.websiteUrl ?? undefined,
      bio: user.bio ?? undefined,
      joinedAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : new Date(user.createdAt).toISOString(),
    },
    publicSettings: settings,
    stats,
    publicSessions,
    ...filtered,
  } satisfies PublicProfileResponse & { _unused?: typeof githubLogin }
}

export const getCallerPublicProfile = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<PublicProfileMineResponse | null> => {
  const db = getRuntimeDatabase(runtime)
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = rows[0]
  if (!user) return null

  const settings = parseSettings(user.publicProfileSettings)

  return {
    success: true as const,
    enabled: user.publicProfileEnabled,
    username: user.username,
    bio: user.bio ?? undefined,
    websiteUrl: user.websiteUrl ?? undefined,
    settings,
    profileViewCount: user.profileViewCount ?? 0,
  }
}

export const updateCallerPublicProfile = async (
  runtime: ApiRuntime,
  userId: string,
  patch: UpdatePublicProfileSettingsRequest,
): Promise<PublicProfileMineResponse | null> => {
  const db = getRuntimeDatabase(runtime)

  const current = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const user = current[0]
  if (!user) return null

  const currentSettings = parseSettings(user.publicProfileSettings)
  const nextSettings: PublicProfileSettings = {
    ...currentSettings,
    ...(patch.settings ?? {}),
  }

  const updateSet: Partial<typeof users.$inferInsert> = {
    publicProfileSettings: nextSettings,
    updatedAt: new Date(),
  }

  if (typeof patch.enabled === 'boolean') {
    updateSet.publicProfileEnabled = patch.enabled
  }

  if (patch.bio !== undefined) {
    updateSet.bio = patch.bio
  }

  if (patch.websiteUrl !== undefined) {
    updateSet.websiteUrl = patch.websiteUrl
  }

  await db.update(users).set(updateSet).where(eq(users.id, userId))

  return getCallerPublicProfile(runtime, userId)
}

export const recordPublicProfileView = async (
  runtime: ApiRuntime,
  params: {
    username: string
    viewerKey: string
    viewerUserId?: string | null
    now?: Date
  },
): Promise<{ recorded: boolean; userFound: boolean; isPublic: boolean }> => {
  const user = await findUserByUsername(runtime, params.username)
  if (!user) return { recorded: false, userFound: false, isPublic: false }
  if (!user.publicProfileEnabled) {
    return { recorded: false, userFound: true, isPublic: false }
  }
  if (params.viewerUserId === user.id) {
    return { recorded: false, userFound: true, isPublic: true }
  }

  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()
  const day = now.toISOString().slice(0, 10)

  const existing = await db
    .select({ id: profileViews.id })
    .from(profileViews)
    .where(
      and(
        eq(profileViews.userId, user.id),
        eq(profileViews.viewerKey, params.viewerKey),
        eq(profileViews.day, day),
      ),
    )
    .limit(1)

  if (existing[0]) {
    return { recorded: false, userFound: true, isPublic: true }
  }

  await db.insert(profileViews).values({
    id: crypto.randomUUID(),
    userId: user.id,
    viewerKey: params.viewerKey,
    viewedAt: now,
    day,
  })

  await db
    .update(users)
    .set({ profileViewCount: (user.profileViewCount ?? 0) + 1 })
    .where(eq(users.id, user.id))

  return { recorded: true, userFound: true, isPublic: true }
}
