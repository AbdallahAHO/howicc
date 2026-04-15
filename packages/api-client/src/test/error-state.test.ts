import { describe, expect, it } from 'vitest'
import {
  deriveApiErrorRenderState,
  isApiErrorCode,
  isApiErrorResponse,
  isRetryableApiError,
} from '../error-state'

describe('api error state helpers', () => {
  it('recognizes structured error envelopes from the API', () => {
    expect(
      isApiErrorResponse({
        success: false,
        code: 'cli_token_invalid',
        error: 'Invalid or revoked CLI token.',
      }),
    ).toBe(true)

    expect(
      isApiErrorResponse({
        success: false,
        code: 'unknown_error',
        error: 'nope',
      }),
    ).toBe(false)
  })

  it('derives frontend rendering flags from the canonical error catalog', () => {
    const authState = deriveApiErrorRenderState('cli_token_invalid')
    const uploadState = deriveApiErrorRenderState({
      success: false,
      code: 'upload_expired',
      error: 'The upload session expired.',
    })

    expect(isApiErrorCode('cli_token_invalid')).toBe(true)
    expect(authState.requiresLogin).toBe(true)
    expect(authState.isAuthError).toBe(true)
    expect(uploadState.requiresResync).toBe(true)
    expect(uploadState.retryable).toBe(true)
    expect(isRetryableApiError({ success: false, code: 'upload_expired', error: 'expired' })).toBe(
      true,
    )
  })
})
