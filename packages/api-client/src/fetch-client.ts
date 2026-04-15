import createOpenApiFetchClient from 'openapi-fetch'
import type { Client } from 'openapi-fetch'
import type { paths } from './generated/openapi'

export type ApiClientConfig = {
  baseUrl: string
  getToken?: () => Promise<string | null>
  fetch?: typeof fetch
  headers?: HeadersInit
  credentials?: RequestCredentials
}

export type ApiFetchClient = Client<paths>

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.replace(/\/+$/, '')

const buildRequestHeaders = async (
  config: ApiClientConfig,
  request: Request,
) => {
  const headers = new Headers(request.headers)

  if (config.headers) {
    const configuredHeaders = new Headers(config.headers)

    configuredHeaders.forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const token = await config.getToken?.()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

const createConfiguredFetch = (config: ApiClientConfig): ((request: Request) => Promise<Response>) =>
  async request => {
    const headers = await buildRequestHeaders(config, request)

    return (config.fetch ?? fetch)(
      new Request(request, {
        credentials: config.credentials ?? request.credentials,
        headers,
      }),
    )
  }

/**
 * Creates the low-level OpenAPI fetch client used by all higher-level helpers in this package.
 *
 * This is the right entrypoint when a caller wants direct access to generated `GET`/`POST`/`PUT`
 * methods while still inheriting shared auth, headers, and base URL behavior.
 *
 * @example
 * ```ts
 * const client = createApiFetchClient({
 *   baseUrl: 'https://api.howi.cc',
 *   getToken: async () => sessionStorage.getItem('token'),
 * })
 *
 * const response = await client.GET('/health')
 * ```
 */
export const createApiFetchClient = (config: ApiClientConfig): ApiFetchClient =>
  createOpenApiFetchClient<paths>({
    baseUrl: normalizeBaseUrl(config.baseUrl),
    fetch: createConfiguredFetch(config),
  })
