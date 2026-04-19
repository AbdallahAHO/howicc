import { createRoute, z } from '@hono/zod-openapi'
import {
  errorResponseSchema,
  providerIdSchema,
  sessionTypeSchema,
  userProfileSchema,
  visibilitySchema,
} from './shared'

const isoDateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

export const profileResponseSchema = z
  .object({
    success: z.literal(true),
    profile: userProfileSchema.nullable(),
    digestCount: z.number().int().nonnegative(),
    message: z.string().optional(),
  })
  .openapi('ProfileResponse')

export const recomputeProfileResponseSchema = z
  .object({
    success: z.literal(true),
    profile: userProfileSchema,
    recomputed: z.literal(true),
  })
  .openapi('ProfileRecomputeResponse')

export const getProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  tags: ['Profiles'],
  summary: 'Get the authenticated user profile',
  description:
    'Returns the materialized cross-session profile for the current user. The endpoint accepts either a CLI bearer token or a Better Auth browser session cookie. If the user has not synced any digests yet, the API returns `profile: null` with `digestCount: 0` instead of a 404.',
  operationId: 'getProfile',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'User profile or an empty state when no synced sessions exist yet',
      content: {
        'application/json': {
          schema: profileResponseSchema,
        },
      },
    },
    401: {
      description: 'The caller is not authenticated with either bearer token or browser session cookie',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Profile resolution failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const profileStatsSchema = z
  .object({
    digestCount: z.number().int().nonnegative(),
    totalSessions: z.number().int().nonnegative(),
    totalDurationMs: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    activeDays: z.number().int().nonnegative(),
    currentStreak: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    firstSessionAt: isoDateTimeSchema.optional(),
    lastSessionAt: isoDateTimeSchema.optional(),
  })
  .openapi('ProfileStats')

export const profileStatsResponseSchema = z
  .object({
    success: z.literal(true),
    stats: profileStatsSchema.nullable(),
    digestCount: z.number().int().nonnegative(),
    message: z.string().optional(),
  })
  .openapi('ProfileStatsResponse')

export const profileActivityItemSchema = z
  .object({
    conversationId: z.string(),
    slug: z.string(),
    title: z.string(),
    visibility: visibilitySchema,
    provider: providerIdSchema,
    projectKey: z.string(),
    projectPath: z.string().optional(),
    sessionCreatedAt: isoDateTimeSchema,
    syncedAt: isoDateTimeSchema,
    durationMs: z.number().int().nonnegative().optional(),
    estimatedCostUsd: z.number().nonnegative().optional(),
    toolRunCount: z.number().int().nonnegative(),
    turnCount: z.number().int().nonnegative(),
    messageCount: z.number().int().nonnegative(),
    sessionType: sessionTypeSchema,
    hasPlan: z.boolean(),
    models: z.array(z.string()),
    repository: z
      .object({
        fullName: z.string(),
        source: z.enum(['git_remote', 'pr_link', 'cwd_derived']),
      })
      .nullable(),
  })
  .openapi('ProfileActivityItem')

export const profileActivityResponseSchema = z
  .object({
    success: z.literal(true),
    items: z.array(profileActivityItemSchema),
    nextCursor: z.string().optional(),
    total: z.number().int().nonnegative(),
  })
  .openapi('ProfileActivityResponse')

export const getProfileStatsRoute = createRoute({
  method: 'get',
  path: '/profile/stats',
  tags: ['Profiles'],
  summary: 'Get lightweight stats for the authenticated user',
  description:
    "Returns a compact snapshot of the current user's profile — session count, total cost, total duration, active days, and current streak. Designed for dashboard headers where the full `/profile` payload is too heavy. If no digests exist yet, `stats` is `null` with `digestCount: 0`.",
  operationId: 'getProfileStats',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'Profile stats snapshot or an empty state when no synced sessions exist yet',
      content: {
        'application/json': {
          schema: profileStatsResponseSchema,
        },
      },
    },
    401: {
      description: 'The caller is not authenticated with either bearer token or browser session cookie',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Profile stats resolution failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const getProfileActivityRoute = createRoute({
  method: 'get',
  path: '/profile/activity',
  tags: ['Profiles'],
  summary: 'Paginated activity feed for the authenticated user',
  description:
    "Returns the authenticated user's synced sessions ordered by session creation time (newest first). Used by the web dashboard feed and the `/sessions` list. Pagination is cursor-based: pass the previous response's `nextCursor` to continue.",
  operationId: 'getProfileActivity',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  request: {
    query: z.object({
      cursor: z.string().optional().openapi({
        description: 'Pass `nextCursor` from the previous response. ISO 8601 timestamp — items strictly before it are returned.',
        format: 'date-time',
      }),
      limit: z
        .string()
        .optional()
        .openapi({
          description: 'Number of items to return (1–50). Defaults to 20.',
          example: '20',
        }),
    }),
  },
  responses: {
    200: {
      description: 'A page of activity items plus an optional `nextCursor` for the next page',
      content: {
        'application/json': {
          schema: profileActivityResponseSchema,
        },
      },
    },
    401: {
      description: 'The caller is not authenticated with either bearer token or browser session cookie',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Activity feed resolution failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export type ProfileStats = z.infer<typeof profileStatsSchema>
export type ProfileStatsResponse = z.infer<typeof profileStatsResponseSchema>
export type ProfileActivityItem = z.infer<typeof profileActivityItemSchema>
export type ProfileActivityResponse = z.infer<typeof profileActivityResponseSchema>
export type ProfileResponse = z.infer<typeof profileResponseSchema>

export const recomputeProfileRoute = createRoute({
  method: 'post',
  path: '/profile/recompute',
  tags: ['Profiles'],
  summary: 'Recompute the authenticated user profile',
  description:
    'Forces a fresh profile aggregation from the current conversation digests for the authenticated user. This is useful after a sync or when debugging stale profile materializations.',
  operationId: 'recomputeProfile',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'Profile was recomputed successfully',
      content: {
        'application/json': {
          schema: recomputeProfileResponseSchema,
        },
      },
    },
    401: {
      description: 'The caller is not authenticated with either bearer token or browser session cookie',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Profile recomputation failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
