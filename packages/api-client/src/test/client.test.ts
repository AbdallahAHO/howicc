import { describe, expect, it, vi } from 'vitest'
import { createApiClient, createApiFetchClient } from '../index'

describe('@howicc/api-client', () => {
  it('injects bearer auth and shared headers into generated fetch requests', async () => {
    const fetchMock = vi.fn(async (request: Request) =>
      new Response(JSON.stringify({ success: true, status: 'ok' }), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }),
    )

    const client = createApiFetchClient({
      baseUrl: 'https://api.howi.cc/',
      fetch: fetchMock as typeof fetch,
      getToken: async () => 'hwi_test_token',
      headers: {
        'X-HowiCC-Client': 'tests',
      },
    })

    await client.GET('/health')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const request = fetchMock.mock.calls[0]?.[0]

    expect(request).toBeInstanceOf(Request)
    expect(request?.url).toBe('https://api.howi.cc/health')
    expect(request?.headers.get('Authorization')).toBe('Bearer hwi_test_token')
    expect(request?.headers.get('X-HowiCC-Client')).toBe('tests')
  })

  it('preserves the domain-oriented helper surface for CLI consumers', async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      if (request.url.endsWith('/cli-auth/whoami')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: 'user_1',
              email: 'abdallah@example.com',
              name: 'Abdallah',
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        )
      }

      throw new Error(`Unexpected request in test: ${request.url}`)
    })

    const api = createApiClient({
      baseUrl: 'https://api.howi.cc',
      fetch: fetchMock as typeof fetch,
      getToken: async () => 'hwi_test_token',
    })

    const whoami = await api.cliAuth.whoami()

    expect(whoami).toEqual({
      success: true,
      user: {
        id: 'user_1',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
  })

  it('covers the browser-authenticated CLI authorize step', async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      if (request.url.endsWith('/cli-auth/authorize')) {
        return new Response(
          JSON.stringify({
            success: true,
            grantId: 'grant_1',
            redirectUrl: 'http://127.0.0.1:8787/callback?code=code_1&state=state_1',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        )
      }

      throw new Error(`Unexpected request in test: ${request.url}`)
    })

    const api = createApiClient({
      baseUrl: 'https://api.howi.cc',
      fetch: fetchMock as typeof fetch,
    })

    const response = await api.cliAuth.authorize({
      callbackUrl: 'http://127.0.0.1:8787/callback',
      codeChallenge: 'challenge_1',
      state: 'state_1',
    })

    expect(response).toEqual({
      success: true,
      grantId: 'grant_1',
      redirectUrl: 'http://127.0.0.1:8787/callback?code=code_1&state=state_1',
    })
  })

  it('uploads raw asset bytes without JSON coercion', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          success: true,
          uploadId: 'upload_1',
          kind: 'source_bundle',
          key: 'draft-uploads/upload_1/source_bundle',
          bytes: 4,
          sha256: 'hash_1',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      ),
    )

    const api = createApiClient({
      baseUrl: 'https://api.howi.cc/',
      fetch: fetchMock as typeof fetch,
      getToken: async () => 'hwi_test_token',
      headers: {
        'X-HowiCC-Client': 'tests',
      },
    })
    const payload = Uint8Array.from([0, 1, 2, 255])

    const response = await api.uploads.uploadAsset({
      uploadId: 'upload_1',
      kind: 'source_bundle',
      body: payload,
      contentType: 'application/gzip',
    })

    expect(response).toEqual({
      success: true,
      uploadId: 'upload_1',
      kind: 'source_bundle',
      key: 'draft-uploads/upload_1/source_bundle',
      bytes: 4,
      sha256: 'hash_1',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const requestUrl = fetchMock.mock.calls[0]?.[0]
    const requestInit = fetchMock.mock.calls[0]?.[1]

    expect(requestUrl).toBe('https://api.howi.cc/uploads/upload_1/assets/source_bundle')
    expect(requestInit?.method).toBe('PUT')
    expect(requestInit?.headers).toBeInstanceOf(Headers)
    expect((requestInit?.headers as Headers).get('Authorization')).toBe(
      'Bearer hwi_test_token',
    )
    expect((requestInit?.headers as Headers).get('Content-Type')).toBe(
      'application/gzip',
    )
    expect((requestInit?.headers as Headers).get('X-HowiCC-Client')).toBe('tests')
    expect(requestInit?.body).toBeInstanceOf(Uint8Array)
    expect(Buffer.from(requestInit?.body as Uint8Array)).toEqual(Buffer.from(payload))
  })

  it('preserves status information for HTML viewer responses', async () => {
    const api = createApiClient({
      baseUrl: 'https://api.howi.cc',
      fetch: vi.fn(async () =>
        new Response('<h2>Access denied</h2>', {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
          status: 401,
        }),
      ) as typeof fetch,
    })

    const response = await api.viewer.getProtectedHtml()

    expect(response).toEqual({
      ok: false,
      status: 401,
      html: '<h2>Access denied</h2>',
    })
  })
})
