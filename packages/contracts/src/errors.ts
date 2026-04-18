import { z } from '@hono/zod-openapi'

export const apiErrorCatalog = {
  validationFailed: {
    code: 'validation_failed',
    httpStatus: 400,
    title: 'Validation failed',
    description: 'The request payload, params, or query string did not match the API contract.',
    category: 'validation',
    userAction: 'fix_input',
    retryable: false,
  },
  browserSessionRequired: {
    code: 'browser_session_required',
    httpStatus: 401,
    title: 'Browser session required',
    description: 'The caller must be signed in with a valid browser session cookie.',
    category: 'auth',
    userAction: 'login',
    retryable: false,
  },
  authRequired: {
    code: 'auth_required',
    httpStatus: 401,
    title: 'Authentication required',
    description: 'The caller must provide a valid bearer token or browser session.',
    category: 'auth',
    userAction: 'login',
    retryable: false,
  },
  cliTokenInvalid: {
    code: 'cli_token_invalid',
    httpStatus: 401,
    title: 'CLI token invalid',
    description: 'The CLI bearer token is missing, invalid, or revoked.',
    category: 'auth',
    userAction: 'login',
    retryable: false,
  },
  cliCallbackInvalid: {
    code: 'cli_callback_invalid',
    httpStatus: 400,
    title: 'CLI callback invalid',
    description: 'The CLI auth callback must target localhost or 127.0.0.1.',
    category: 'validation',
    userAction: 'fix_input',
    retryable: false,
  },
  cliAuthGrantInvalid: {
    code: 'cli_auth_grant_invalid',
    httpStatus: 400,
    title: 'CLI auth grant invalid',
    description: 'The one-time CLI login grant is invalid, expired, or already consumed.',
    category: 'validation',
    userAction: 'retry',
    retryable: true,
  },
  cliAuthUserMissing: {
    code: 'cli_auth_user_missing',
    httpStatus: 400,
    title: 'CLI auth user missing',
    description: 'The login grant resolved to a user that no longer exists.',
    category: 'internal',
    userAction: 'contact_support',
    retryable: false,
  },
  repoIdentifierInvalid: {
    code: 'repo_identifier_invalid',
    httpStatus: 400,
    title: 'Repository identifier invalid',
    description: 'The repository owner or name contains unsupported characters.',
    category: 'validation',
    userAction: 'fix_input',
    retryable: false,
  },
  conversationNotFound: {
    code: 'conversation_not_found',
    httpStatus: 404,
    title: 'Conversation not found',
    description: 'The requested conversation does not exist or is not visible to the caller.',
    category: 'not_found',
    userAction: 'refresh',
    retryable: false,
  },
  artifactNotFound: {
    code: 'artifact_not_found',
    httpStatus: 404,
    title: 'Artifact not found',
    description: 'The requested artifact does not exist on the current conversation revision.',
    category: 'not_found',
    userAction: 'refresh',
    retryable: false,
  },
  assetNotFound: {
    code: 'asset_not_found',
    httpStatus: 404,
    title: 'Asset not found',
    description: 'The requested asset does not exist on the current conversation revision.',
    category: 'not_found',
    userAction: 'refresh',
    retryable: false,
  },
  tokenNotFound: {
    code: 'token_not_found',
    httpStatus: 404,
    title: 'Token not found',
    description: 'The referenced API token does not exist or does not belong to the caller.',
    category: 'not_found',
    userAction: 'refresh',
    retryable: false,
  },
  uploadRequestInvalid: {
    code: 'upload_request_invalid',
    httpStatus: 400,
    title: 'Upload request invalid',
    description: 'The upload payload or finalize request did not match the expected draft session state.',
    category: 'validation',
    userAction: 'fix_input',
    retryable: false,
  },
  uploadAssetTargetMissing: {
    code: 'upload_asset_target_missing',
    httpStatus: 404,
    title: 'Upload asset target missing',
    description: 'The draft upload session does not contain the requested asset target.',
    category: 'not_found',
    userAction: 'resync',
    retryable: true,
  },
  uploadSessionNotFound: {
    code: 'upload_session_not_found',
    httpStatus: 404,
    title: 'Upload session not found',
    description: 'The referenced upload session does not exist for the current user.',
    category: 'not_found',
    userAction: 'resync',
    retryable: true,
  },
  uploadConflict: {
    code: 'upload_conflict',
    httpStatus: 409,
    title: 'Upload conflict',
    description: 'The upload session can no longer accept the requested change.',
    category: 'conflict',
    userAction: 'resync',
    retryable: true,
  },
  uploadExpired: {
    code: 'upload_expired',
    httpStatus: 410,
    title: 'Upload expired',
    description: 'The draft upload session expired and a new sync is required.',
    category: 'expired',
    userAction: 'resync',
    retryable: true,
  },
  pricingCatalogUnavailable: {
    code: 'pricing_catalog_unavailable',
    httpStatus: 502,
    title: 'Pricing catalog unavailable',
    description: 'The upstream pricing catalog could not be fetched successfully.',
    category: 'upstream',
    userAction: 'retry',
    retryable: true,
  },
  internalError: {
    code: 'internal_error',
    httpStatus: 500,
    title: 'Internal error',
    description: 'The server failed to complete the request.',
    category: 'internal',
    userAction: 'retry',
    retryable: true,
  },
} as const

export type ApiErrorName = keyof typeof apiErrorCatalog
export type ApiErrorCode = (typeof apiErrorCatalog)[ApiErrorName]['code']
export type ApiErrorStatus = (typeof apiErrorCatalog)[ApiErrorName]['httpStatus']
export type ApiErrorCategory = (typeof apiErrorCatalog)[ApiErrorName]['category']
export type ApiErrorUserAction = (typeof apiErrorCatalog)[ApiErrorName]['userAction']

const apiErrorCodeValues = Object.values(apiErrorCatalog).map(
  error => error.code,
) as [ApiErrorCode, ...ApiErrorCode[]]

export const apiErrorCodeSchema = z.enum(apiErrorCodeValues).openapi('ApiErrorCode')

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    code: apiErrorCodeSchema,
    error: z.string().openapi({
      example: 'Authentication required.',
    }),
  })
  .openapi('ErrorResponse')

export const getApiErrorDefinition = <TName extends ApiErrorName>(name: TName) =>
  apiErrorCatalog[name]

export const getApiErrorByCode = (code: ApiErrorCode) =>
  Object.values(apiErrorCatalog).find(error => error.code === code)
