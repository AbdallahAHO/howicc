import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import {
  getArtifactRoute,
  getRenderDocumentRoute,
  getSharedRenderDocumentRoute,
  listConversationsRoute,
  updateConversationVisibilityRoute,
} from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import {
  getSharedRenderDocumentBySlug,
  getStoredArtifactPreview,
  getStoredRenderDocument,
  listUserConversations,
  updateConversationVisibility,
} from '../modules/conversations/service'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import { authenticateCliToken } from '../lib/cli-token-auth'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'

type ConversationsRouteEnv = ApiAuthRuntimeEnv

const app = new OpenAPIHono()

const resolveViewerUserId = async (
  runtimeEnv: ConversationsRouteEnv,
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

app.use('/shared/*', async (c, next) => {
  const runtimeEnv = c.env as ConversationsRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.use('/conversations/*', async (c, next) => {
  const runtimeEnv = c.env as ConversationsRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'PATCH', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(listConversationsRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const conversations = await listUserConversations(runtime, c.req.header('Authorization'))

    return c.json(
      {
        success: true as const,
        conversations,
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

app.openapi(getRenderDocumentRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const payload = await getStoredRenderDocument(
      runtime,
      c.req.valid('param').conversationId,
      c.req.header('Authorization'),
    )

    return c.json(payload as never, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status = response.status === 404 ? 404 : 500

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

app.openapi(getSharedRenderDocumentRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ConversationsRouteEnv
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const viewerUserId = await resolveViewerUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    const slug = c.req.param('slug') ?? ''
    if (!slug || slug.length > 120) {
      return c.json(
        toApiErrorPayload('conversationNotFound', 'Conversation not found.'),
        404,
      )
    }
    const result = await getSharedRenderDocumentBySlug(runtime, slug, {
      authorizationHeader: c.req.header('Authorization'),
      viewerUserId,
    })

    return c.json(
      {
        ...(result.renderDocument as Record<string, unknown>),
        sharedMeta: result.sharedMeta,
      } as never,
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status = response.status === 404 ? 404 : 500

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

app.openapi(updateConversationVisibilityRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ConversationsRouteEnv
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const viewerUserId = await resolveViewerUserId(
      runtimeEnv,
      runtime,
      c.req.header('Authorization'),
      c.req.raw.headers,
    )

    if (!viewerUserId) {
      return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
    }

    const conversationId = c.req.param('conversationId') ?? ''
    if (!conversationId) {
      return c.json(
        toApiErrorPayload('conversationNotFound', 'Conversation not found.'),
        404,
      )
    }
    const body = (await c.req.json().catch(() => null)) as
      | { visibility?: unknown }
      | null
    const visibility = body?.visibility
    if (
      visibility !== 'private' &&
      visibility !== 'unlisted' &&
      visibility !== 'public'
    ) {
      return c.json(
        toApiErrorPayload(
          'validationFailed',
          'visibility must be one of: private, unlisted, public.',
        ),
        400,
      )
    }

    const result = await updateConversationVisibility(
      runtime,
      conversationId,
      visibility,
      { viewerUserId },
    )

    return c.json(
      {
        success: true as const,
        conversationId: result.conversationId,
        slug: result.slug,
        visibility: result.visibility,
        updatedAt: result.updatedAt,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status =
      response.status === 401 ? 401 : response.status === 404 ? 404 : 500

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

app.openapi(getArtifactRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const { conversationId, artifactId } = c.req.valid('param')
    const artifact = await getStoredArtifactPreview(
      runtime,
      conversationId,
      artifactId,
      c.req.header('Authorization'),
    )

    if (!artifact) {
      return c.json(
        toApiErrorPayload('artifactNotFound', 'Artifact not found.'),
        404,
      )
    }

    return c.json(
      {
        success: true as const,
        artifactId: artifact.artifactId,
        content: artifact.content,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status = response.status === 404 ? 404 : 500

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
