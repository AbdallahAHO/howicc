import {
  getApiErrorDefinition,
  type ApiErrorCode,
  type ApiErrorName,
  type ApiErrorStatus,
} from '@howicc/contracts'

export class ApiError extends Error {
  readonly errorName: ApiErrorName
  readonly code: ApiErrorCode
  readonly status: ApiErrorStatus

  constructor(errorName: ApiErrorName, message?: string) {
    const definition = getApiErrorDefinition(errorName)

    super(message ?? definition.title)
    this.name = 'ApiError'
    this.errorName = errorName
    this.code = definition.code
    this.status = definition.httpStatus
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError

export const toApiErrorPayload = (
  errorName: ApiErrorName,
  message?: string,
) => {
  const definition = getApiErrorDefinition(errorName)

  return {
    success: false as const,
    code: definition.code,
    error: message ?? definition.title,
  }
}

export const toApiErrorResponse = (
  error: unknown,
  fallbackErrorName: ApiErrorName,
) => {
  if (isApiError(error)) {
    return {
      status: error.status,
      code: error.code,
      error: error.message,
    }
  }

  const fallback = getApiErrorDefinition(fallbackErrorName)

  return {
    status: fallback.httpStatus,
    code: fallback.code,
    error: error instanceof Error ? error.message : fallback.title,
  }
}
