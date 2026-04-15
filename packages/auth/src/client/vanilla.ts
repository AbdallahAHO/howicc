import { createAuthClient } from 'better-auth/client'

export const createHowiccAuthClient = (options?: {
  baseURL?: string
  basePath?: string
}) =>
  createAuthClient({
    baseURL: options?.baseURL,
    basePath: options?.basePath ?? '/auth',
    fetchOptions: {
      credentials: 'include',
    },
  })

export type HowiccAuthClient = ReturnType<typeof createHowiccAuthClient>
