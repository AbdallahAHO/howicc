import type { AstroGlobal } from 'astro'
import { createServerApiClient } from './client'
import { getRuntimeWebConfig } from '../runtime/web-config.server'

const resolveServerApiBaseUrl = () => getRuntimeWebConfig().apiServerUrl

export const fetchProtectedDebug = async (astro: AstroGlobal) => {
  const api = createServerApiClient({
    baseUrl: resolveServerApiBaseUrl(),
    cookie: astro.request.headers.get('cookie'),
  })
  const response = await api.viewer.getProtectedHtml()

  if (!response.ok) {
    return null
  }

  return response.html
}
