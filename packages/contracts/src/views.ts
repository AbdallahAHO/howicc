import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema } from './shared'

export const recordSessionViewResponseSchema = z
  .object({
    success: z.literal(true),
    recorded: z.boolean(),
    viewCount: z.number().int().nonnegative(),
  })
  .openapi('RecordSessionViewResponse')

export const recordSessionViewRoute = createRoute({
  method: 'post',
  path: '/sessions/{conversationId}/view',
  tags: ['Views'],
  summary: 'Record a view on a shared conversation',
  description:
    'Fire-and-forget endpoint bumped by the public `/s/:slug` page when a non-owner views the conversation. Debounced per IP per conversation per day to prevent inflation. Returns the updated `viewCount` for the conversation and whether the view was counted (`recorded`).',
  operationId: 'recordSessionView',
  request: {
    params: z.object({
      conversationId: z.string().openapi({
        param: { name: 'conversationId', in: 'path' },
      }),
    }),
  },
  responses: {
    200: {
      description: 'View considered',
      content: {
        'application/json': {
          schema: recordSessionViewResponseSchema,
        },
      },
    },
    404: {
      description: 'Unknown conversation or not publicly accessible',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export type RecordSessionViewResponse = z.infer<typeof recordSessionViewResponseSchema>
