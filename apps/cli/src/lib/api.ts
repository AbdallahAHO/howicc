import { createApiClient } from '@howicc/api-client'
import { CliConfigStore } from '../config/store'

export const createCliApiClient = (store = new CliConfigStore()) =>
  createApiClient({
    baseUrl: store.getApiBaseUrl(),
    getToken: async () => store.getAuthToken() ?? null,
  })
