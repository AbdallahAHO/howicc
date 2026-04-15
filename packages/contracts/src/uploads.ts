import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema, uploadAssetKindSchema, uploadAssetSchema } from './shared'

const createUploadSessionBodySchema = z.object({
  sourceRevisionHash: z.string(),
  assets: z.array(uploadAssetSchema),
})

const createUploadSessionResponseSchema = z.object({
  success: z.literal(true),
  uploadId: z.string(),
  assetTargets: z.array(
    z.object({
      kind: uploadAssetKindSchema,
      key: z.string(),
      uploadPath: z.string(),
    }),
  ),
})

const uploadRevisionAssetParamsSchema = z.object({
  uploadId: z.string(),
  kind: uploadAssetKindSchema,
})

const uploadRevisionAssetResponseSchema = z.object({
  success: z.literal(true),
  uploadId: z.string(),
  kind: uploadAssetKindSchema,
  key: z.string(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string(),
})

export const createUploadSessionRoute = createRoute({
  method: 'post',
  path: '/uploads/sessions',
  tags: ['Uploads'],
  summary: 'Create an upload session for a new revision',
  description:
    'Starts a draft upload session for a conversation revision. The response includes the storage targets that the CLI should upload next.',
  operationId: 'createUploadSession',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createUploadSessionBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Upload session created',
      content: {
        'application/json': {
          schema: createUploadSessionResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const uploadRevisionAssetRoute = createRoute({
  method: 'put',
  path: '/uploads/{uploadId}/assets/{kind}',
  tags: ['Uploads'],
  summary: 'Upload asset bytes for a draft revision session',
  description:
    'Uploads a single asset body for an existing draft upload session. Each asset kind must match a target announced by the initial session creation response.',
  operationId: 'uploadRevisionAsset',
  security: [{ BearerAuth: [] }],
  request: {
    params: uploadRevisionAssetParamsSchema,
    body: {
      required: true,
      content: {
        'application/octet-stream': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Asset bytes stored for the draft upload session',
      content: {
        'application/json': {
          schema: uploadRevisionAssetResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Upload session or draft asset not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Upload session state conflict',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    410: {
      description: 'Upload session expired',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

const finalizeRevisionBodySchema = z.object({
  uploadId: z.string(),
  sourceRevisionHash: z.string(),
  conversationId: z.string().optional(),
  sourceApp: z.string(),
  sourceSessionId: z.string(),
  sourceProjectKey: z.string(),
  title: z.string(),
  assets: z.array(
    z.object({
      kind: uploadAssetKindSchema,
      key: z.string(),
      sha256: z.string(),
      bytes: z.number().int().nonnegative(),
    }),
  ),
})

const finalizeRevisionResponseSchema = z.object({
  success: z.literal(true),
  conversationId: z.string(),
  revisionId: z.string(),
})

export const finalizeRevisionRoute = createRoute({
  method: 'post',
  path: '/uploads/finalize',
  tags: ['Uploads'],
  summary: 'Finalize a conversation revision upload',
  description:
    'Validates the uploaded assets, stores the new revision, and updates the conversation to point at the latest current revision.',
  operationId: 'finalizeUploadRevision',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: finalizeRevisionBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Revision finalized',
      content: {
        'application/json': {
          schema: finalizeRevisionResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Upload session not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Upload session state conflict',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    410: {
      description: 'Upload session expired',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
