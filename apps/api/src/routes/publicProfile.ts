import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import {
  getPublicProfileMineRoute,
  getPublicProfileRoute,
  isValidPublicUsername,
  recordPublicProfileViewRoute,
  updatePublicProfileSettingsRequestSchema,
  updatePublicProfileSettingsRoute,
} from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import {
  getCallerPublicProfile,
  getPublicProfile,
  recordPublicProfileView,
  updateCallerPublicProfile,
} from '../modules/public-profile/service'
import { deriveViewerKey } from '../lib/viewer-key'

const app = new OpenAPIHono()

type PublicProfileRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: PublicProfileRouteEnv) => createApiRuntime(env as never)

app.use('/profile/public/*', async (c, next) => {
  const runtimeEnv = c.env as PublicProfileRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  })(c, next)
})

app.use('/profile/public-settings', async (c, next) => {
  const runtimeEnv = c.env as PublicProfileRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'PATCH', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(getPublicProfileRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as PublicProfileRouteEnv
    const username = c.req.param('username')

    if (!isValidPublicUsername(username.toLowerCase())) {
      return c.json(
        toApiErrorPayload('userNotFound', 'Unknown user.'),
        404,
      )
    }

    const runtime = getRuntime(runtimeEnv)
    const payload = await getPublicProfile(runtime, username)

    if (!payload) {
      return c.json(toApiErrorPayload('userNotFound', 'Unknown user.'), 404)
    }

    return c.json(payload, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

app.openapi(getPublicProfileMineRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as PublicProfileRouteEnv
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user.id) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const runtime = getRuntime(runtimeEnv)
    const payload = await getCallerPublicProfile(runtime, session.user.id)
    if (!payload) {
      return c.json(toApiErrorPayload('internalError', 'User not found.'), 500)
    }

    return c.json(payload, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

app.openapi(updatePublicProfileSettingsRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as PublicProfileRouteEnv
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user.id) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = updatePublicProfileSettingsRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        toApiErrorPayload('validationFailed', 'Invalid payload.'),
        400,
      )
    }

    const runtime = getRuntime(runtimeEnv)
    const payload = await updateCallerPublicProfile(
      runtime,
      session.user.id,
      parsed.data,
    )

    if (!payload) {
      return c.json(toApiErrorPayload('internalError', 'User not found.'), 500)
    }

    return c.json(payload, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

app.openapi(recordPublicProfileViewRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as PublicProfileRouteEnv
    const username = c.req.param('username')
    if (!isValidPublicUsername(username.toLowerCase())) {
      return c.json(toApiErrorPayload('userNotFound', 'Unknown user.'), 404)
    }

    const runtime = getRuntime(runtimeEnv)
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(
      () => null,
    )
    const viewerKey = await deriveViewerKey(
      c.req.raw,
      runtimeEnv,
      session?.user.id ?? null,
    )
    const outcome = await recordPublicProfileView(runtime, {
      username,
      viewerKey,
      viewerUserId: session?.user.id ?? null,
    })

    if (!outcome.userFound || !outcome.isPublic) {
      return c.json(toApiErrorPayload('userNotFound', 'Unknown user.'), 404)
    }

    return c.json(
      { success: true as const, recorded: outcome.recorded },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

export default app
