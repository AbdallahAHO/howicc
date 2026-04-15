import { OpenAPIHono } from '@hono/zod-openapi'
import { getArtifactRoute, getRenderDocumentRoute, listConversationsRoute } from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import {
  getStoredArtifactPreview,
  getStoredRenderDocument,
  listUserConversations,
} from '../modules/conversations/service'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

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
