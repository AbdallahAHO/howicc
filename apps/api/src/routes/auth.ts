import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'

const app = new OpenAPIHono()

type AuthRouteEnv = ApiAuthRuntimeEnv

app.use(
  '/auth/*',
  async (c, next) => {
    const runtimeEnv = c.env as AuthRouteEnv
    const origin = runtimeEnv.WEB_APP_URL

    return cors({
      origin,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    })(c, next)
  },
)

app.on(['GET', 'POST'], '/auth/*', async c => {
  const runtimeEnv = c.env as AuthRouteEnv
  const auth = createApiAuth(runtimeEnv)

  return auth.handler(c.req.raw)
})

export default app
