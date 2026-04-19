import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema, repoProfileSchema, visibilitySchema } from './shared'

const isoDateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

const nonNegativeIntSchema = z.number().int().nonnegative()

const repoParamsSchema = z.object({
  owner: z.string().openapi({
    param: {
      name: 'owner',
      in: 'path',
    },
    example: 'openai',
    description: 'Repository owner or organization slug.',
  }),
  name: z.string().openapi({
    param: {
      name: 'name',
      in: 'path',
    },
    example: 'openai-node',
    description: 'Repository name.',
  }),
})

export const repoVisibilityValues = ['public', 'members', 'private'] as const

export const repoVisibilitySchema = z
  .enum(repoVisibilityValues)
  .openapi('RepoVisibility')

export const repoAdminPermissionValues = [
  'admin',
  'maintain',
  'write',
  'read',
  'none',
] as const

export const repoAdminPermissionSchema = z
  .enum(repoAdminPermissionValues)
  .openapi('RepoAdminPermission')

export const repoProfileResponseSchema = z
  .object({
    success: z.literal(true),
    repository: z.string().openapi({
      example: 'openai/openai-node',
    }),
    profile: repoProfileSchema.nullable(),
    sessionCount: z.number().int().nonnegative(),
    visibility: repoVisibilitySchema,
    message: z.string().optional(),
    /**
     * When the viewer is a repo admin we include the hidden convo count so the
     * UI can surface "N hidden — manage in settings" without a second request.
     */
    adminHiddenCount: nonNegativeIntSchema.optional(),
  })
  .openapi('RepoProfileResponse')

export type RepoProfileResponse = z.infer<typeof repoProfileResponseSchema>

export const getRepoProfileRoute = createRoute({
  method: 'get',
  path: '/repo/{owner}/{name}',
  tags: ['Repositories'],
  summary: 'Get the public aggregate profile for a repository',
  description:
    "Aggregates the current public conversation digests for the requested repository across all users. Only conversations whose current revision is publicly visible are included in the result. If the repo is marked `private`, the response omits the profile (sessionCount=0, message set). The `members` tier returns a profile only for viewers who have ≥ read access on GitHub.",
  operationId: 'getRepoProfile',
  request: {
    params: repoParamsSchema,
  },
  responses: {
    200: {
      description: 'Repository profile or an empty state when no public sessions exist',
      content: {
        'application/json': {
          schema: repoProfileResponseSchema,
        },
      },
    },
    400: {
      description: 'The repository owner or name contains unsupported characters',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Repository profile aggregation failed unexpectedly',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// -------- Admin surfaces ---------------------------------------------------

export const repoHiddenConversationSchema = z
  .object({
    conversationId: z.string(),
    slug: z.string(),
    title: z.string(),
    visibility: visibilitySchema,
    ownerUserId: z.string(),
    ownerName: z.string().optional(),
    hiddenBy: z.string(),
    hiddenAt: isoDateTimeSchema,
  })
  .openapi('RepoHiddenConversation')

export const repoSettingsResponseSchema = z
  .object({
    success: z.literal(true),
    repository: z.string(),
    visibility: repoVisibilitySchema,
    updatedBy: z.string().optional(),
    updatedAt: isoDateTimeSchema.optional(),
    viewerPermission: repoAdminPermissionSchema,
    hidden: z.array(repoHiddenConversationSchema),
    consentRequired: z.boolean().openapi({
      description:
        'True when the caller must re-acknowledge the private-repo notice before editing. Resets every 30 days and after any visibility change by another admin.',
    }),
  })
  .openapi('RepoSettingsResponse')

export const getRepoSettingsRoute = createRoute({
  method: 'get',
  path: '/repo/{owner}/{name}/settings',
  tags: ['Repositories'],
  summary: 'Get admin settings for a repository',
  description:
    "Returns repo visibility, hidden-conversation list, and the caller's GitHub permission on the repo. Requires `admin` or `maintain` access verified through the caller's GitHub OAuth token.",
  operationId: 'getRepoSettings',
  security: [{ BrowserSession: [] }],
  request: {
    params: repoParamsSchema,
  },
  responses: {
    200: {
      description: 'Admin settings payload',
      content: {
        'application/json': {
          schema: repoSettingsResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const consentCheckResponseSchema = z
  .object({
    success: z.literal(true),
    consentRequired: z.boolean(),
    consentedAt: isoDateTimeSchema.optional(),
  })
  .openapi('RepoConsentCheckResponse')

export const getRepoConsentStatusRoute = createRoute({
  method: 'get',
  path: '/repo/{owner}/{name}/consent',
  tags: ['Repositories'],
  summary: 'Check whether the admin must re-acknowledge the private-repo notice',
  description:
    "Returns whether the caller must re-acknowledge the private-repo notice before editing this repo's settings. A fresh consent is required when the repo is private AND the caller has not consented within the last 30 days, or whenever another admin changed the visibility since the caller's last consent.",
  operationId: 'getRepoConsentStatus',
  security: [{ BrowserSession: [] }],
  request: {
    params: repoParamsSchema,
  },
  responses: {
    200: {
      description: 'Consent status',
      content: { 'application/json': { schema: consentCheckResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const recordRepoConsentRequestSchema = z
  .object({
    acknowledged: z.literal(true).openapi({
      description: 'Must be `true` — the client asserts the admin clicked the confirmation button.',
    }),
  })
  .openapi('RecordRepoConsentRequest')

export const recordRepoConsentResponseSchema = z
  .object({
    success: z.literal(true),
    consentedAt: isoDateTimeSchema,
  })
  .openapi('RecordRepoConsentResponse')

export const recordRepoConsentRoute = createRoute({
  method: 'post',
  path: '/repo/{owner}/{name}/consent',
  tags: ['Repositories'],
  summary: 'Record an admin’s private-repo acknowledgement',
  description:
    "Records the caller's acknowledgement of the private-repo notice. The acknowledgement unlocks other admin endpoints (visibility change, hide/unhide) for 30 days, or until another admin changes visibility.",
  operationId: 'recordRepoConsent',
  security: [{ BrowserSession: [] }],
  request: {
    params: repoParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: recordRepoConsentRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Consent recorded',
      content: {
        'application/json': {
          schema: recordRepoConsentResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid consent payload',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const repoVisibilityPreviewItemSchema = z
  .object({
    conversationId: z.string(),
    slug: z.string(),
    title: z.string(),
    visibility: visibilitySchema,
    ownerUserId: z.string(),
    ownerName: z.string().optional(),
    sessionCreatedAt: isoDateTimeSchema,
  })
  .openapi('RepoVisibilityPreviewItem')

export const repoVisibilityPreviewResponseSchema = z
  .object({
    success: z.literal(true),
    repository: z.string(),
    currentVisibility: repoVisibilitySchema,
    targetVisibility: repoVisibilitySchema,
    wouldAggregateCount: nonNegativeIntSchema,
    items: z.array(repoVisibilityPreviewItemSchema),
    previewToken: z.string().openapi({
      description:
        "Opaque token returned alongside the preview. The caller MUST include it in the subsequent PATCH /visibility request as proof the preview was viewed. The server rejects PATCH requests missing a recent preview token to force the two-step review flow.",
    }),
  })
  .openapi('RepoVisibilityPreviewResponse')

export const previewRepoVisibilityRoute = createRoute({
  method: 'get',
  path: '/repo/{owner}/{name}/preview',
  tags: ['Repositories'],
  summary: 'Preview which conversations would be aggregated at a target visibility',
  description:
    'Lists the public/unlisted conversations that would appear on the repo page if visibility were changed to `target`. Returns an opaque `previewToken` that must accompany the subsequent PATCH /visibility request to prove the preview was reviewed. Prevents accidental one-click exposure of private aggregation.',
  operationId: 'previewRepoVisibility',
  security: [{ BrowserSession: [] }],
  request: {
    params: repoParamsSchema,
    query: z.object({
      target: repoVisibilitySchema.openapi({
        description: 'The visibility tier the caller is considering.',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Preview payload + consent token',
      content: {
        'application/json': {
          schema: repoVisibilityPreviewResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid target visibility',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const updateRepoVisibilityRequestSchema = z
  .object({
    visibility: repoVisibilitySchema,
    previewToken: z.string().openapi({
      description:
        'Opaque token returned by GET /repo/:owner/:name/preview?target=... The server validates the token matches the requested visibility and is at most 10 minutes old.',
    }),
  })
  .openapi('UpdateRepoVisibilityRequest')

export const updateRepoVisibilityResponseSchema = z
  .object({
    success: z.literal(true),
    repository: z.string(),
    visibility: repoVisibilitySchema,
    updatedAt: isoDateTimeSchema,
  })
  .openapi('UpdateRepoVisibilityResponse')

export const updateRepoVisibilityRoute = createRoute({
  method: 'patch',
  path: '/repo/{owner}/{name}/visibility',
  tags: ['Repositories'],
  summary: 'Update the repository visibility tier',
  description:
    'Flips the repo visibility tier. Requires admin consent (POST /consent within 24h) AND a valid preview token (GET /preview within 10 min). Individual conversation visibility is NOT affected — this only changes the aggregation ceiling.',
  operationId: 'updateRepoVisibility',
  security: [{ BrowserSession: [] }],
  request: {
    params: repoParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: updateRepoVisibilityRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Visibility updated',
      content: {
        'application/json': {
          schema: updateRepoVisibilityResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid or stale preview token, or missing/stale consent',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

const hideConversationParamsSchema = repoParamsSchema.extend({
  conversationId: z.string().openapi({
    param: { name: 'conversationId', in: 'path' },
    description: 'Conversation id to hide or unhide from repo aggregation.',
  }),
})

export const hideRepoConversationResponseSchema = z
  .object({
    success: z.literal(true),
    conversationId: z.string(),
    hiddenAt: isoDateTimeSchema,
  })
  .openapi('HideRepoConversationResponse')

export const hideRepoConversationRoute = createRoute({
  method: 'post',
  path: '/repo/{owner}/{name}/hide/{conversationId}',
  tags: ['Repositories'],
  summary: 'Hide a conversation from the repo aggregation',
  description:
    "Excludes the conversation from `/r/:owner/:name` stats without touching the conversation's own visibility — the owner can still share the `/s/:slug` link directly. Requires admin consent. Idempotent: a repeat call refreshes `hiddenAt`.",
  operationId: 'hideRepoConversation',
  security: [{ BrowserSession: [] }],
  request: {
    params: hideConversationParamsSchema,
  },
  responses: {
    200: {
      description: 'Conversation hidden',
      content: {
        'application/json': {
          schema: hideRepoConversationResponseSchema,
        },
      },
    },
    400: {
      description: 'Missing or stale consent',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Conversation does not exist or is not linked to this repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const unhideRepoConversationResponseSchema = z
  .object({
    success: z.literal(true),
    conversationId: z.string(),
  })
  .openapi('UnhideRepoConversationResponse')

export const unhideRepoConversationRoute = createRoute({
  method: 'delete',
  path: '/repo/{owner}/{name}/hide/{conversationId}',
  tags: ['Repositories'],
  summary: 'Unhide a conversation from the repo aggregation',
  description:
    'Removes a conversation from the hidden-from-aggregation set so it reappears in `/r/:owner/:name` stats. Requires admin consent.',
  operationId: 'unhideRepoConversation',
  security: [{ BrowserSession: [] }],
  request: {
    params: hideConversationParamsSchema,
  },
  responses: {
    200: {
      description: 'Conversation unhidden',
      content: {
        'application/json': {
          schema: unhideRepoConversationResponseSchema,
        },
      },
    },
    400: {
      description: 'Missing or stale consent',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: 'Caller lacks admin/maintain permission on the repo',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Conversation was not hidden',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export type RepoVisibility = z.infer<typeof repoVisibilitySchema>
export type RepoAdminPermission = z.infer<typeof repoAdminPermissionSchema>
export type RepoHiddenConversation = z.infer<typeof repoHiddenConversationSchema>
export type RepoSettingsResponse = z.infer<typeof repoSettingsResponseSchema>
export type RepoConsentCheckResponse = z.infer<typeof consentCheckResponseSchema>
export type RecordRepoConsentRequest = z.infer<typeof recordRepoConsentRequestSchema>
export type RecordRepoConsentResponse = z.infer<typeof recordRepoConsentResponseSchema>
export type RepoVisibilityPreviewItem = z.infer<typeof repoVisibilityPreviewItemSchema>
export type RepoVisibilityPreviewResponse = z.infer<
  typeof repoVisibilityPreviewResponseSchema
>
export type UpdateRepoVisibilityRequest = z.infer<typeof updateRepoVisibilityRequestSchema>
export type UpdateRepoVisibilityResponse = z.infer<
  typeof updateRepoVisibilityResponseSchema
>
export type HideRepoConversationResponse = z.infer<
  typeof hideRepoConversationResponseSchema
>
export type UnhideRepoConversationResponse = z.infer<
  typeof unhideRepoConversationResponseSchema
>
