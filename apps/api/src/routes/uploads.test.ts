import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api-error'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  authenticateCliToken: vi.fn(),
  createRevisionUploadSession: vi.fn(),
  uploadRevisionAssetBytes: vi.fn(),
  finalizeRevisionUpload: vi.fn(),
}))

vi.mock('../runtime', () => ({
  createApiRuntime: mocks.createApiRuntime,
}))

vi.mock('../lib/cli-token-auth', async () => {
  const actual = await vi.importActual('../lib/cli-token-auth')
  return {
    ...actual,
    authenticateCliToken: mocks.authenticateCliToken,
  }
})

vi.mock('../modules/uploads/service', () => ({
  createRevisionUploadSession: mocks.createRevisionUploadSession,
  uploadRevisionAssetBytes: mocks.uploadRevisionAssetBytes,
  finalizeRevisionUpload: mocks.finalizeRevisionUpload,
}))

const { default: uploadRoutes } = await import('./uploads')

const runtimeEnv = {
  APP_ENV: 'test',
}

describe('upload routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue(runtimeEnv)
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the CLI token is missing or invalid', async () => {
    mocks.authenticateCliToken.mockResolvedValue(null)

    const response = await uploadRoutes.request('http://localhost/uploads/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceRevisionHash: 'rev-hash',
        assets: [],
      }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_token_invalid',
      error: 'Missing or invalid CLI token.',
    })
  })

  it('maps upload asset conflicts to 409 instead of 500', async () => {
    mocks.uploadRevisionAssetBytes.mockRejectedValue(
      new ApiError('uploadConflict', 'The upload session has already been finalized.'),
    )

    const response = await uploadRoutes.request(
      'http://localhost/uploads/upload_1/assets/source_bundle',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer hwi_test',
          'content-type': 'application/octet-stream',
        },
        body: 'payload',
      },
      runtimeEnv,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'upload_conflict',
      error: 'The upload session has already been finalized.',
    })
  })

  it('passes raw upload bytes through to the upload service', async () => {
    const payload = Uint8Array.from([0, 1, 2, 255])
    mocks.uploadRevisionAssetBytes.mockResolvedValue({
      success: true,
      uploadId: 'upload_1',
      kind: 'source_bundle',
      key: 'draft-uploads/upload_1/source_bundle',
      bytes: payload.byteLength,
      sha256: 'hash_1',
    })

    const response = await uploadRoutes.request(
      'http://localhost/uploads/upload_1/assets/source_bundle',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer hwi_test',
          'content-type': 'application/octet-stream',
        },
        body: payload,
      },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    expect(mocks.uploadRevisionAssetBytes).toHaveBeenCalledTimes(1)
    expect(mocks.uploadRevisionAssetBytes.mock.calls[0]?.[1]).toMatchObject({
      id: 'user_1',
      email: 'abdallah@example.com',
    })
    const serviceInput = mocks.uploadRevisionAssetBytes.mock.calls[0]?.[2] as {
      uploadId: string
      kind: string
      body: ArrayBuffer
      contentType?: string
    }

    expect(serviceInput.uploadId).toBe('upload_1')
    expect(serviceInput.kind).toBe('source_bundle')
    expect(serviceInput.contentType).toBe('application/octet-stream')
    expect(Buffer.from(serviceInput.body)).toEqual(Buffer.from(payload))
  })

  it('maps finalize expiry errors to 410 instead of 500', async () => {
    mocks.finalizeRevisionUpload.mockRejectedValue(
      new ApiError(
        'uploadExpired',
        'The upload session has expired. Start a new sync and try again.',
      ),
    )

    const response = await uploadRoutes.request(
      'http://localhost/uploads/finalize',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer hwi_test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: 'upload_1',
          sourceRevisionHash: 'rev-hash',
          sourceApp: 'claude_code',
          sourceSessionId: 'session_1',
          sourceProjectKey: 'project-key',
          title: 'Session title',
          assets: [],
        }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'upload_expired',
      error: 'The upload session has expired. Start a new sync and try again.',
    })
  })

  it('sanitizes unexpected finalize errors instead of returning raw internal messages', async () => {
    mocks.finalizeRevisionUpload.mockRejectedValue(
      new Error('Failed query: insert into "conversations" (...) values (...)'),
    )

    const response = await uploadRoutes.request(
      'http://localhost/uploads/finalize',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer hwi_test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: 'upload_1',
          sourceRevisionHash: 'rev-hash',
          sourceApp: 'claude_code',
          sourceSessionId: 'session_1',
          sourceProjectKey: 'project-key',
          title: 'Session title',
          assets: [],
        }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'internal_error',
      error: 'Internal error',
    })
  })
})
