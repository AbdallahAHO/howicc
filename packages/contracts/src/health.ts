import { createRoute } from '@hono/zod-openapi'
import { healthResponseSchema } from './shared'

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description:
    'Reports whether the API worker is reachable and ready to serve requests.',
  operationId: 'getHealth',
  responses: {
    200: {
      description: 'API is healthy',
      content: {
        'application/json': {
          schema: healthResponseSchema,
        },
      },
    },
  },
})
