import { createRoute, z } from '@hono/zod-openapi'
import {
  errorResponseSchema,
  providerIdSchema,
  sessionTypeSchema,
} from './shared'

const isoDateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

const isoDateSchema = z.string().openapi({
  format: 'date',
  example: '2026-04-14',
})

const nonNegativeIntSchema = z.number().int().nonnegative()

export const publicProfileSettingsSchema = z
  .object({
    showActivityHeatmap: z.boolean(),
    showCost: z.boolean(),
    showRepositories: z.boolean(),
    showSessionTypes: z.boolean(),
    showToolsLanguages: z.boolean(),
    showBadges: z.boolean(),
  })
  .openapi('PublicProfileSettings')

export const publicProfileUserSchema = z
  .object({
    username: z.string().openapi({ example: 'abdallahali' }),
    displayName: z.string(),
    avatarUrl: z.string().optional(),
    githubUrl: z.string().openapi({ example: 'https://github.com/abdallahali' }),
    websiteUrl: z.string().optional(),
    bio: z.string().optional(),
    joinedAt: isoDateTimeSchema,
  })
  .openapi('PublicProfileUser')

export const publicProfileStatsSchema = z
  .object({
    sessionCount: nonNegativeIntSchema,
    totalDurationMs: nonNegativeIntSchema,
    activeDays: nonNegativeIntSchema,
    currentStreak: nonNegativeIntSchema,
    longestStreak: nonNegativeIntSchema,
    firstSessionAt: isoDateTimeSchema.optional(),
    lastSessionAt: isoDateTimeSchema.optional(),
  })
  .openapi('PublicProfileStats')

export const publicProfileBadgeSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    earnedAt: isoDateTimeSchema.optional(),
  })
  .openapi('PublicProfileBadge')

export const publicProfileActivitySchema = z
  .object({
    dailyActivity: z.array(
      z
        .object({
          date: isoDateSchema,
          sessionCount: nonNegativeIntSchema,
        })
        .openapi('PublicProfileDailyActivity'),
    ),
    hourlyDistribution: z.array(nonNegativeIntSchema).length(24),
    weekdayDistribution: z.array(nonNegativeIntSchema).length(7),
  })
  .openapi('PublicProfileActivity')

export const publicProfileSessionCardSchema = z
  .object({
    conversationId: z.string(),
    slug: z.string(),
    title: z.string(),
    provider: providerIdSchema,
    sessionType: sessionTypeSchema,
    projectKey: z.string(),
    repository: z.string().optional(),
    messageCount: nonNegativeIntSchema,
    toolRunCount: nonNegativeIntSchema,
    durationMs: nonNegativeIntSchema.optional(),
    viewCount: nonNegativeIntSchema,
    firstMessageExcerpt: z.string().optional(),
    sessionCreatedAt: isoDateTimeSchema,
  })
  .openapi('PublicProfileSessionCard')

export const publicProfileRepoSchema = z
  .object({
    fullName: z.string(),
    sessionCount: nonNegativeIntSchema,
  })
  .openapi('PublicProfileRepo')

export const publicProfileTopToolSchema = z
  .object({
    name: z.string(),
    count: nonNegativeIntSchema,
  })
  .openapi('PublicProfileTopTool')

export const publicProfileResponseSchema = z
  .object({
    success: z.literal(true),
    user: publicProfileUserSchema,
    publicSettings: publicProfileSettingsSchema,
    stats: publicProfileStatsSchema,
    badges: z.array(publicProfileBadgeSchema).optional(),
    activity: publicProfileActivitySchema.optional(),
    sessionTypes: z.record(z.string(), nonNegativeIntSchema).optional(),
    languages: z.record(z.string(), nonNegativeIntSchema).optional(),
    topTools: z.array(publicProfileTopToolSchema).optional(),
    publicSessions: z.array(publicProfileSessionCardSchema),
    publicRepos: z.array(publicProfileRepoSchema).optional(),
    cost: z
      .object({
        totalUsd: z.number().nonnegative(),
      })
      .optional(),
  })
  .openapi('PublicProfileResponse')

export const getPublicProfileRoute = createRoute({
  method: 'get',
  path: '/profile/public/{username}',
  tags: ['Public Profile'],
  summary: 'Get a public profile by username',
  description:
    "Returns the filtered public aggregate for the requested user. Every optional section respects the owner's visibility flags; disabled sections are omitted from the payload entirely. Returns 404 when the user does not exist or has not opted into a public profile.",
  operationId: 'getPublicProfile',
  request: {
    params: z.object({
      username: z.string().openapi({
        param: { name: 'username', in: 'path' },
        example: 'abdallahali',
        description:
          'Lowercased GitHub login. Usernames are the authoritative identifier for public profiles; they mirror GitHub as the source of truth.',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Public profile payload',
      content: {
        'application/json': {
          schema: publicProfileResponseSchema,
        },
      },
    },
    404: {
      description: 'Unknown user or profile is not public',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const updatePublicProfileSettingsRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    bio: z.string().max(280).nullable().optional(),
    websiteUrl: z.string().url().max(512).nullable().optional(),
    settings: publicProfileSettingsSchema.partial().optional(),
  })
  .openapi('UpdatePublicProfileSettingsRequest')

export const publicProfileMineResponseSchema = z
  .object({
    success: z.literal(true),
    enabled: z.boolean(),
    username: z.string(),
    bio: z.string().optional(),
    websiteUrl: z.string().optional(),
    settings: publicProfileSettingsSchema,
    profileViewCount: nonNegativeIntSchema,
  })
  .openapi('PublicProfileMineResponse')

export const updatePublicProfileSettingsRoute = createRoute({
  method: 'patch',
  path: '/profile/public-settings',
  tags: ['Public Profile'],
  summary: 'Update the caller’s public-profile opt-in and settings',
  description:
    "Updates the authenticated user's public profile configuration: the master enabled flag, optional bio and website, and the six per-section visibility flags. Returns the full canonical settings after the patch so the caller can re-render without a second fetch.",
  operationId: 'updatePublicProfileSettings',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updatePublicProfileSettingsRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Updated public profile settings',
      content: {
        'application/json': {
          schema: publicProfileMineResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid payload',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const getPublicProfileMineRoute = createRoute({
  method: 'get',
  path: '/profile/public-settings',
  tags: ['Public Profile'],
  summary: 'Get the caller’s own public-profile configuration',
  description:
    "Returns the authenticated user's public profile configuration so the settings page can render its initial state without guessing. Mirrors the shape returned by PATCH /profile/public-settings.",
  operationId: 'getPublicProfileMine',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'Public profile configuration',
      content: {
        'application/json': {
          schema: publicProfileMineResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const recordPublicProfileViewResponseSchema = z
  .object({
    success: z.literal(true),
    recorded: z.boolean(),
  })
  .openapi('RecordPublicProfileViewResponse')

export const recordPublicProfileViewRoute = createRoute({
  method: 'post',
  path: '/profile/public/{username}/view',
  tags: ['Public Profile'],
  summary: 'Record a view on a public profile',
  description:
    'Fire-and-forget endpoint that bumps the per-user `profile_view_count`. Debounced per IP per day to prevent inflation. Returns `recorded: false` when the view was debounced.',
  operationId: 'recordPublicProfileView',
  request: {
    params: z.object({
      username: z.string().openapi({
        param: { name: 'username', in: 'path' },
      }),
    }),
  },
  responses: {
    200: {
      description: 'View was considered',
      content: {
        'application/json': {
          schema: recordPublicProfileViewResponseSchema,
        },
      },
    },
    404: {
      description: 'Unknown user or profile is not public',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export type PublicProfileSettings = z.infer<typeof publicProfileSettingsSchema>
export type PublicProfileUser = z.infer<typeof publicProfileUserSchema>
export type PublicProfileStats = z.infer<typeof publicProfileStatsSchema>
export type PublicProfileBadge = z.infer<typeof publicProfileBadgeSchema>
export type PublicProfileActivity = z.infer<typeof publicProfileActivitySchema>
export type PublicProfileSessionCard = z.infer<typeof publicProfileSessionCardSchema>
export type PublicProfileRepo = z.infer<typeof publicProfileRepoSchema>
export type PublicProfileTopTool = z.infer<typeof publicProfileTopToolSchema>
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>
export type PublicProfileMineResponse = z.infer<typeof publicProfileMineResponseSchema>
export type UpdatePublicProfileSettingsRequest = z.infer<
  typeof updatePublicProfileSettingsRequestSchema
>
export type RecordPublicProfileViewResponse = z.infer<
  typeof recordPublicProfileViewResponseSchema
>
