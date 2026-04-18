import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import {
  getProfileActivityRoute,
  getProfileRoute,
  getProfileStatsRoute,
  recomputeProfileRoute,
} from '@howicc/contracts'
import {
  getDigestCount,
  getOrComputeUserProfile,
  getUserProfileStats,
  listUserProfileActivity,
  recomputeUserProfile,
} from '../modules/profile/service'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import { createApiRuntime } from '../runtime'
import { authenticateCliToken } from '../lib/cli-token-auth'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'

const app = new OpenAPIHono()

type ProfileRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: ProfileRouteEnv) =>
  createApiRuntime(env as never)

const noSyncedSessionsMessage =
  'No sessions synced yet. Use the CLI to sync your Claude Code sessions.'

const resolveAuthenticatedUserId = async (
  runtimeEnv: ProfileRouteEnv,
  runtime: ReturnType<typeof getRuntime>,
  authorizationHeader: string | undefined,
  headers: Headers,
) => {
  const cliUser = await authenticateCliToken(runtime, authorizationHeader)
  if (cliUser?.id) return cliUser.id

  const auth = createApiAuth(runtimeEnv)
  const session = await auth.api.getSession({ headers })

  return session?.user.id ?? null
}

app.use('/profile/*', async (c, next) => {
  const runtimeEnv = c.env as ProfileRouteEnv

  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(getProfileRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ProfileRouteEnv
    const runtime = getRuntime(runtimeEnv)
    const userId = await resolveAuthenticatedUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const digestCount = await getDigestCount(runtime, userId)

    if (digestCount === 0) {
      return c.json(
        {
          success: true as const,
          profile: null,
          digestCount: 0,
          message: noSyncedSessionsMessage,
        },
        200,
      )
    }

    const profile = await getOrComputeUserProfile(runtime, userId)

    return c.json(
      {
        success: true as const,
        profile,
        digestCount,
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

app.openapi(getProfileStatsRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ProfileRouteEnv
    const runtime = getRuntime(runtimeEnv)
    const userId = await resolveAuthenticatedUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const digestCount = await getDigestCount(runtime, userId)

    if (digestCount === 0) {
      return c.json(
        {
          success: true as const,
          stats: null,
          digestCount: 0,
          message: noSyncedSessionsMessage,
        },
        200,
      )
    }

    const stats = await getUserProfileStats(runtime, userId)

    return c.json(
      {
        success: true as const,
        stats,
        digestCount,
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

app.openapi(getProfileActivityRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ProfileRouteEnv
    const runtime = getRuntime(runtimeEnv)
    const userId = await resolveAuthenticatedUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const cursor = c.req.query('cursor') || undefined
    const rawLimit = c.req.query('limit')
    const parsedLimit =
      typeof rawLimit === 'string' && rawLimit.length > 0
        ? Number.parseInt(rawLimit, 10)
        : undefined
    const page = await listUserProfileActivity(runtime, userId, {
      cursor,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })

    return c.json(
      {
        success: true as const,
        items: page.items,
        nextCursor: page.nextCursor,
        total: page.total,
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

app.openapi(recomputeProfileRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ProfileRouteEnv
    const runtime = getRuntime(runtimeEnv)
    const userId = await resolveAuthenticatedUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!userId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const profile = await recomputeUserProfile(runtime, userId)

    return c.json(
      {
        success: true as const,
        profile,
        recomputed: true as const,
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

export default app
