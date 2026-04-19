import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import {
  createApiTokenRoute,
  listApiTokensRoute,
  revokeApiTokenRoute,
} from '@howicc/contracts'
import {
  createUserApiToken,
  listUserApiTokens,
  revokeUserApiToken,
} from '../modules/api-tokens/service'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import { createApiRuntime } from '../runtime'
import { authenticateCliToken } from '../lib/cli-token-auth'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'

type ApiTokensRouteEnv = ApiAuthRuntimeEnv

const app = new OpenAPIHono()

const resolveViewerUserId = async (
  runtimeEnv: ApiTokensRouteEnv,
  runtime: ReturnType<typeof createApiRuntime>,
  authorizationHeader: string | undefined,
  headers: Headers,
): Promise<string | null> => {
  const cliUser = await authenticateCliToken(runtime, authorizationHeader)
  if (cliUser?.id) return cliUser.id

  const auth = createApiAuth(runtimeEnv)
  const session = await auth.api.getSession({ headers })
  return session?.user.id ?? null
}

app.use('/api-tokens', async (c, next) => {
  const runtimeEnv = c.env as ApiTokensRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.use('/api-tokens/*', async (c, next) => {
  const runtimeEnv = c.env as ApiTokensRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(listApiTokensRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ApiTokensRouteEnv
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const userId = await resolveViewerUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const tokens = await listUserApiTokens(runtime, userId)
    return c.json({ success: true as const, tokens }, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      response.status === 401 ? 401 : 500,
    )
  }
})

app.openapi(createApiTokenRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ApiTokensRouteEnv
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const userId = await resolveViewerUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const result = await createUserApiToken(runtime, userId)
    return c.json(
      {
        success: true as const,
        token: result.token,
        secret: result.secret,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      response.status === 401 ? 401 : 500,
    )
  }
})

app.openapi(revokeApiTokenRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ApiTokensRouteEnv
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const userId = await resolveViewerUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const tokenId = c.req.param('tokenId') ?? ''
    if (!tokenId) {
      return c.json(toApiErrorPayload('tokenNotFound', 'Token not found.'), 404)
    }

    const result = await revokeUserApiToken(runtime, userId, tokenId)
    if (!result) {
      return c.json(toApiErrorPayload('tokenNotFound', 'Token not found.'), 404)
    }

    return c.json(
      {
        success: true as const,
        id: result.id,
        revokedAt: result.revokedAt,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status = response.status === 401 ? 401 : response.status === 404 ? 404 : 500
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      status,
    )
  }
})

export default app
