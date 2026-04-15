import { OpenAPIHono } from '@hono/zod-openapi'
import {
  createUploadSessionRoute,
  finalizeRevisionRoute,
  uploadRevisionAssetRoute,
} from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import { authenticateCliToken } from '../lib/cli-token-auth'
import {
  createRevisionUploadSession,
  finalizeRevisionUpload,
  uploadRevisionAssetBytes,
} from '../modules/uploads/service'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

app.openapi(createUploadSessionRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const user = await authenticateCliToken(runtime, c.req.header('Authorization'))

    if (!user) {
      return c.json(
        toApiErrorPayload('cliTokenInvalid', 'Missing or invalid CLI token.'),
        401,
      )
    }

    const result = await createRevisionUploadSession(runtime, user, c.req.valid('json'))

    return c.json(
      {
        success: true as const,
        uploadId: result.uploadId,
        assetTargets: result.assetTargets,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status =
      response.status === 400 || response.status === 401 ? response.status : 500
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

app.openapi(uploadRevisionAssetRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const user = await authenticateCliToken(runtime, c.req.header('Authorization'))

    if (!user) {
      return c.json(
        toApiErrorPayload('cliTokenInvalid', 'Missing or invalid CLI token.'),
        401,
      )
    }

    const { uploadId, kind } = c.req.valid('param')
    const result = await uploadRevisionAssetBytes(runtime, user, {
      uploadId,
      kind,
      body: await c.req.raw.arrayBuffer(),
      contentType: c.req.header('Content-Type'),
    })

    return c.json(
      {
        success: true as const,
        uploadId: result.uploadId,
        kind: result.kind,
        key: result.key,
        bytes: result.bytes,
        sha256: result.sha256,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status =
      response.status === 400 ||
      response.status === 401 ||
      response.status === 404 ||
      response.status === 409 ||
      response.status === 410
        ? response.status
        : 500
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

app.openapi(finalizeRevisionRoute, async c => {
  try {
    const runtime = createApiRuntime(c.env as Record<string, unknown>)
    const user = await authenticateCliToken(runtime, c.req.header('Authorization'))

    if (!user) {
      return c.json(
        toApiErrorPayload('cliTokenInvalid', 'Missing or invalid CLI token.'),
        401,
      )
    }

    const result = await finalizeRevisionUpload(runtime, user, c.req.valid('json'))

    return c.json(
      {
        success: true as const,
        conversationId: result.conversationId,
        revisionId: result.revisionId,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status =
      response.status === 400 ||
      response.status === 401 ||
      response.status === 404 ||
      response.status === 409 ||
      response.status === 410
        ? response.status
        : 500
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
