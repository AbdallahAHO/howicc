import { OpenAPIHono } from '@hono/zod-openapi'
import { healthRoute } from '@howicc/contracts'

const app = new OpenAPIHono()

app.openapi(healthRoute, c =>
  c.json(
    {
      success: true as const,
      status: 'ok',
    },
    200,
  ),
)

export default app
