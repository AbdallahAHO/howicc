import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { getViewerProtectedRoute, getViewerSessionRoute } from '@howicc/contracts'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

type ViewerRouteEnv = ApiAuthRuntimeEnv

const toViewerSessionPayload = (
  session:
    | {
        user: {
          id: string
          email: string
          name: string
          image?: string | null
          emailVerified?: boolean
          createdAt?: string | Date
          updatedAt?: string | Date
          isAnonymous?: boolean
        }
        session: {
          id: string
          userId: string
          createdAt: string | Date
          updatedAt: string | Date
          expiresAt: string | Date
        }
      }
    | null,
) => ({
  success: true as const,
  authenticated: Boolean(session?.user && session?.session),
  user: session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
        isAnonymous: session.user.isAnonymous,
      }
    : null,
  session: session?.session
    ? {
        id: session.session.id,
        userId: session.session.userId,
        createdAt: session.session.createdAt,
        updatedAt: session.session.updatedAt,
        expiresAt: session.session.expiresAt,
      }
    : null,
})

app.use('/viewer/*', async (c, next) => {
  const runtimeEnv = c.env as ViewerRouteEnv

  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(getViewerSessionRoute, async c => {
  try {
    const runtimeEnv = c.env as ViewerRouteEnv
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    return c.json(toViewerSessionPayload(session as never), 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      500,
    )
  }
})

app.openapi(getViewerProtectedRoute, async c => {
  try {
    const runtimeEnv = c.env as ViewerRouteEnv
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session) {
      return c.html(
        `
          <h2>Access denied</h2>
          <p>You need to be signed in to see this content.</p>
        `,
        401,
      )
    }

    return c.html(`
      <h2 style="margin: 0 0 0.75rem;">Protected Content - You're In!</h2>
      <p>Welcome to the protected area.</p>
      <p><strong>User ID:</strong> ${escapeHtml(session.user.id)}</p>
      <p><strong>Session ID:</strong> ${escapeHtml(session.session.id)}</p>
      <p><strong>Email:</strong> ${escapeHtml(session.user.email)}</p>
    `)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown viewer protected error.'

    return c.html(
      `
        <h2>Viewer unavailable</h2>
        <p>${escapeHtml(message)}</p>
      `,
      500,
    )
  }
})

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export default app
