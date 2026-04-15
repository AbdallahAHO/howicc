import { QueryClient, type QueryClientConfig } from '@tanstack/react-query'
import createOpenApiQueryClient from 'openapi-react-query'
import { createApiFetchClient, type ApiClientConfig } from './fetch-client'
import { isRetryableApiError } from './error-state'

/**
 * Creates the generated React Query client for HowiCC's OpenAPI surface.
 *
 * Use this in React apps that want typed `useQuery` and `useMutation` helpers directly from the
 * OpenAPI document rather than the domain-oriented wrapper client.
 *
 * @example
 * ```ts
 * const api = createApiQueryClient({
 *   baseUrl: 'https://api.howi.cc',
 *   getToken: async () => localStorage.getItem('token'),
 * })
 *
 * const profileQuery = api.useQuery('get', ApiPaths.getProfile)
 * ```
 */
export const createApiQueryClient = (config: ApiClientConfig) =>
  createOpenApiQueryClient(createApiFetchClient(config))

/**
 * Default query retry policy for HowiCC clients.
 *
 * Only structured API errors that are marked retryable in the shared error catalog will retry,
 * and retries stop after the second failure.
 */
export const shouldRetryApiQuery = (
  failureCount: number,
  error: unknown,
) => {
  if (failureCount >= 2) {
    return false
  }

  if (isRetryableApiError(error)) {
    return true
  }

  return false
}

/**
 * Creates a QueryClient with HowiCC defaults for staleness and retry behavior.
 *
 * @example
 * ```ts
 * const queryClient = createHowiccQueryClient()
 * ```
 */
export const createHowiccQueryClient = (
  config?: QueryClientConfig,
) =>
  new QueryClient({
    ...config,
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryApiQuery,
        ...config?.defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...config?.defaultOptions?.mutations,
      },
    },
  })
