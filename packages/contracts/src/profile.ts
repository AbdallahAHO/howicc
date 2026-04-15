import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema, userProfileSchema } from './shared'

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
