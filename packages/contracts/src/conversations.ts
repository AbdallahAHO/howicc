import { createRoute, z } from '@hono/zod-openapi'
import {
  conversationSummarySchema,
  errorResponseSchema,
  renderDocumentSummarySchema,
  visibilitySchema,
} from './shared'

export const listConversationsRoute = createRoute({
  method: 'get',
  path: '/conversations',
  tags: ['Conversations'],
  summary: 'List conversations for the current user',
  description:
    "Returns the current user's accessible conversations as lightweight list items for navigation and conversation selection.",
  operationId: 'listConversations',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Conversation summaries',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            conversations: z.array(conversationSummarySchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const getRenderDocumentRoute = createRoute({
  method: 'get',
  path: '/conversations/{conversationId}/render',
  tags: ['Conversations'],
  summary: 'Get the current render document for a conversation',
  description:
    "Returns the normalized render document for the conversation's current revision. The render document powers the viewer UI and downstream presentation layers.",
  operationId: 'getConversationRenderDocument',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      conversationId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Render document',
      content: {
        'application/json': {
          schema: renderDocumentSummarySchema,
        },
      },
    },
    404: {
      description: 'Conversation not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const sharedRenderDocumentResponseSchema = renderDocumentSummarySchema.extend({
  sharedMeta: z
    .object({
      slug: z.string(),
      conversationId: z.string(),
      visibility: visibilitySchema,
      ownerUserId: z.string(),
      isOwner: z.boolean(),
      updatedAt: z.string().openapi({ format: 'date-time' }),
    })
    .openapi('SharedConversationMeta'),
})

export const getSharedRenderDocumentRoute = createRoute({
  method: 'get',
  path: '/shared/{slug}',
  tags: ['Conversations'],
  summary: 'Fetch a conversation render document by public slug',
  description:
    "Returns the normalized render document for a conversation identified by its share slug. Private conversations are only visible to the owner (authenticated via CLI bearer token or Better Auth session cookie); unlisted and public conversations are readable without auth. When multiple conversations share the same slug — a historical collision pending schema-level uniqueness — the most-recently-updated match is returned.",
  operationId: 'getSharedRenderDocument',
  security: [{}, { BearerAuth: [] }, { BrowserSession: [] }],
  request: {
    params: z.object({
      slug: z.string().min(1).max(120),
    }),
  },
  responses: {
    200: {
      description: 'Render document plus share metadata',
      content: {
        'application/json': {
          schema: sharedRenderDocumentResponseSchema,
        },
      },
    },
    404: {
      description: 'Slug does not resolve to a visible conversation',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Shared render document resolution failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const updateConversationVisibilityBodySchema = z
  .object({
    visibility: visibilitySchema,
  })
  .openapi('UpdateConversationVisibilityBody')

export const updateConversationVisibilityResponseSchema = z
  .object({
    success: z.literal(true),
    conversationId: z.string(),
    slug: z.string(),
    visibility: visibilitySchema,
    updatedAt: z.string().openapi({ format: 'date-time' }),
  })
  .openapi('UpdateConversationVisibilityResponse')

export const updateConversationVisibilityRoute = createRoute({
  method: 'patch',
  path: '/conversations/{conversationId}/visibility',
  tags: ['Conversations'],
  summary: 'Update the visibility of a conversation',
  description:
    "Flips a conversation between `private`, `unlisted`, and `public`. Only the owner may make this change. Accepts either a CLI bearer token or a Better Auth session cookie.",
  operationId: 'updateConversationVisibility',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  request: {
    params: z.object({
      conversationId: z.string(),
    }),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateConversationVisibilityBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Visibility was updated',
      content: {
        'application/json': {
          schema: updateConversationVisibilityResponseSchema,
        },
      },
    },
    401: {
      description: 'The caller is not authenticated',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Conversation does not exist or is not owned by the caller',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Visibility update failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const getArtifactRoute = createRoute({
  method: 'get',
  path: '/conversations/{conversationId}/artifacts/{artifactId}',
  tags: ['Artifacts'],
  summary: 'Fetch an artifact payload for a conversation revision',
  description:
    'Returns a text preview for a stored artifact associated with the current conversation revision.',
  operationId: 'getConversationArtifact',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      conversationId: z.string(),
      artifactId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Artifact metadata and content preview',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            artifactId: z.string(),
            content: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Artifact not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
