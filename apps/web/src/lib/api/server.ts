import type { AstroGlobal } from 'astro'
import { createServerApiClient } from './client'

const resolveServerApiBaseUrl = () =>
  import.meta.env.API_SERVER_URL ?? import.meta.env.PUBLIC_API_URL

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
