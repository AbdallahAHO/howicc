import { createRoute, z } from '@hono/zod-openapi'
import {
  conversationSummarySchema,
  errorResponseSchema,
  renderDocumentSummarySchema,
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
