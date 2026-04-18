import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema } from './shared'

const dateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

export const apiTokenSummarySchema = z
  .object({
    id: z.string(),
    tokenPrefix: z.string(),
    createdAt: dateTimeSchema,
    revokedAt: dateTimeSchema.optional(),
  })
  .openapi('ApiTokenSummary')

export const listApiTokensResponseSchema = z
  .object({
    success: z.literal(true),
    tokens: z.array(apiTokenSummarySchema),
  })
  .openapi('ListApiTokensResponse')

export const createApiTokenResponseSchema = z
  .object({
    success: z.literal(true),
    token: apiTokenSummarySchema,
    secret: z.string().openapi({
      description:
        'The plaintext bearer token. Returned once at creation time; the server only stores a SHA-256 hash. The caller must capture this value immediately — it cannot be retrieved later.',
    }),
  })
  .openapi('CreateApiTokenResponse')

export const revokeApiTokenResponseSchema = z
  .object({
    success: z.literal(true),
    id: z.string(),
    revokedAt: dateTimeSchema,
  })
  .openapi('RevokeApiTokenResponse')

export const listApiTokensRoute = createRoute({
  method: 'get',
  path: '/api-tokens',
  tags: ['API Tokens'],
  summary: 'List API tokens for the authenticated user',
  description:
    "Returns the caller's API tokens with opaque metadata (id, 12-char prefix, createdAt, revokedAt). Tokens are never returned in plaintext after creation.",
  operationId: 'listApiTokens',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'Token summaries, ordered newest first',
      content: {
        'application/json': {
          schema: listApiTokensResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const createApiTokenRoute = createRoute({
  method: 'post',
  path: '/api-tokens',
  tags: ['API Tokens'],
  summary: 'Mint a new API token for the authenticated user',
  description:
    'Generates a new `hwi_*` bearer token for the caller. The plaintext `secret` is returned once in this response; the server only stores a SHA-256 hash. Pair the new token with the CLI (`howicc login` or a manual config entry) to authenticate subsequent requests.',
  operationId: 'createApiToken',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  responses: {
    200: {
      description: 'Token created; secret returned once',
      content: {
        'application/json': {
          schema: createApiTokenResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export const revokeApiTokenRoute = createRoute({
  method: 'delete',
  path: '/api-tokens/{tokenId}',
  tags: ['API Tokens'],
  summary: 'Revoke an API token owned by the caller',
  description:
    "Sets `revokedAt` on the caller's token. Revoked tokens remain in the list (marked revoked) so the UI can surface audit history; they stop authenticating immediately. Returns 404 when the token does not exist or belongs to a different user — the 404 is deliberate so non-owners can't probe for token ids.",
  operationId: 'revokeApiToken',
  security: [{ BearerAuth: [] }, { BrowserSession: [] }],
  request: {
    params: z.object({
      tokenId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Token was revoked',
      content: {
        'application/json': {
          schema: revokeApiTokenResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Token not found or not owned by the caller',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export type ApiTokenSummary = z.infer<typeof apiTokenSummarySchema>
