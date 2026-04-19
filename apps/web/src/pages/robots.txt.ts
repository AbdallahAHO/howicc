import type { APIRoute } from 'astro'
import { getRuntimeWebConfig } from '../lib/runtime/web-config.server'

export const GET: APIRoute = () => {
  const { siteUrl } = getRuntimeWebConfig()
  const origin = siteUrl.replace(/\/+$/, '')

  const body = `User-agent: *
Allow: /
Disallow: /home
Disallow: /sessions
Disallow: /settings
Disallow: /insights
Disallow: /dashboard
Disallow: /cli/
Disallow: /debug/
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
