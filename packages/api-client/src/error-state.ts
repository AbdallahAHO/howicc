import {
  apiErrorCatalog,
  getApiErrorByCode,
  type ApiErrorCategory,
  type ApiErrorCode,
  type ApiErrorStatus,
  type ApiErrorUserAction,
} from '@howicc/contracts'

export type ApiErrorResponse = {
  success: false
  code: ApiErrorCode
  error: string
}

export type ApiErrorRenderState = {
  code: ApiErrorCode
  category: ApiErrorCategory
  httpStatus: ApiErrorStatus
  userAction: ApiErrorUserAction
  retryable: boolean
  title: string
  description: string
  message: string
  requiresLogin: boolean
  requiresRetry: boolean
  requiresResync: boolean
  shouldRefresh: boolean
  shouldContactSupport: boolean
  isAuthError: boolean
  isConflictError: boolean
  isNotFoundError: boolean
  isValidationError: boolean
}

const apiErrorCodeSet = new Set<ApiErrorCode>(
  Object.values(apiErrorCatalog).map(error => error.code),
)

const resolveApiErrorCode = (
  value: ApiErrorCode | ApiErrorResponse,
): ApiErrorCode => (typeof value === 'string' ? value : value.code)

const resolveApiErrorMessage = (
  value: ApiErrorCode | ApiErrorResponse,
  fallbackTitle: string,
) => (typeof value === 'string' ? fallbackTitle : value.error)

/**
 * Narrow unknown values to one of the canonical public API error codes.
 */
export const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
  typeof value === 'string' && apiErrorCodeSet.has(value as ApiErrorCode)

/**
 * Validates a standard `{ success: false, code, error }` API error envelope.
 */
export const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ApiErrorResponse>

  return (
    candidate.success === false &&
    isApiErrorCode(candidate.code) &&
    typeof candidate.error === 'string'
  )
}

/**
 * Derives frontend-facing rendering and UX flags from the canonical API error catalog.
 *
 * This keeps UI behavior attached to stable machine-readable error metadata instead of string
 * matching on response messages.
 */
export const deriveApiErrorRenderState = (
  value: ApiErrorCode | ApiErrorResponse,
): ApiErrorRenderState => {
  const code = resolveApiErrorCode(value)
  const definition = getApiErrorByCode(code)

  if (!definition) {
    throw new Error(`Unknown API error code: ${code}`)
  }

  return {
    code,
    category: definition.category,
    httpStatus: definition.httpStatus,
    userAction: definition.userAction,
    retryable: definition.retryable,
    title: definition.title,
    description: definition.description,
    message: resolveApiErrorMessage(value, definition.title),
    requiresLogin: definition.userAction === 'login',
    requiresRetry: definition.userAction === 'retry',
    requiresResync: definition.userAction === 'resync',
    shouldRefresh: definition.userAction === 'refresh',
    shouldContactSupport: definition.userAction === 'contact_support',
    isAuthError: definition.category === 'auth',
    isConflictError: definition.category === 'conflict',
    isNotFoundError: definition.category === 'not_found',
    isValidationError: definition.category === 'validation',
  }
}

/**
 * Returns whether a structured API error should be retried automatically.
 */
export const isRetryableApiError = (value: unknown): boolean =>
  isApiErrorResponse(value) && deriveApiErrorRenderState(value).retryable
