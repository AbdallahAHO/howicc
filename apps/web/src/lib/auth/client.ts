import { createHowiccAuthClient } from '@howicc/auth/client/vanilla'

export const createBrowserAuthClient = (
  baseUrl = import.meta.env.PUBLIC_API_URL,
) =>
  createHowiccAuthClient({
    baseURL: baseUrl,
    basePath: '/auth',
  })
