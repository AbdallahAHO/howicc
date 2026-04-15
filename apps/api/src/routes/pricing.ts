import { OpenAPIHono } from '@hono/zod-openapi'
import { openRouterModelsRoute } from '@howicc/contracts'
import { fetchOpenRouterCatalog } from '@howicc/model-pricing'
import { toApiErrorPayload } from '../lib/api-error'

const app = new OpenAPIHono()

app.openapi(openRouterModelsRoute, async c => {
  try {
    const catalog = await fetchOpenRouterCatalog()

    return c.json(
      {
        success: true as const,
        source: catalog.source,
        fetchedAt: catalog.fetchedAt,
        models: catalog.models,
      },
      200,
    )
  } catch (error) {
    return c.json(
      toApiErrorPayload(
        'pricingCatalogUnavailable',
        error instanceof Error ? error.message : 'Failed to fetch OpenRouter models',
      ),
      502,
    )
  }
})

export default app
