import { createApiClient } from '@howicc/api-client'

type ServerApiClientInput = {
  baseUrl: string
  cookie?: string | null
}

export const createBrowserApiClient = (baseUrl: string) =>
  createApiClient({
    baseUrl,
    credentials: 'include',
  })

export const createServerApiClient = ({ baseUrl, cookie }: ServerApiClientInput) =>
  createApiClient({
    baseUrl,
    headers: cookie
      ? {
          cookie,
        }
      : undefined,
  })
