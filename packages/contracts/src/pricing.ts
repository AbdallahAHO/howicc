import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema } from './shared'

const openRouterModelSchema = z.object({
  source: z.literal('openrouter_public_catalog'),
  id: z.string(),
  canonicalSlug: z.string().optional(),
  displayName: z.string(),
  contextLength: z.number().int().optional(),
  promptUsdPerToken: z.number(),
  completionUsdPerToken: z.number(),
  inputCacheReadUsdPerToken: z.number().optional(),
  inputCacheWriteUsdPerToken: z.number().optional(),
})

export const openRouterModelsRoute = createRoute({
  method: 'get',
  path: '/pricing/models',
  tags: ['Pricing'],
  summary: 'Proxy the OpenRouter model catalog',
  description:
    'Returns the latest normalized OpenRouter public pricing catalog snapshot cached by the API.',
  operationId: 'listPricingModels',
  responses: {
    200: {
      description: 'OpenRouter model catalog',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            source: z.literal('openrouter_public_catalog'),
            fetchedAt: z.string(),
            models: z.array(openRouterModelSchema),
          }),
        },
      },
    },
    502: {
      description: 'Upstream fetch failed',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
