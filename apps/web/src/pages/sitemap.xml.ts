import type { APIRoute } from 'astro'
import { createServerApiClient } from '../lib/api/client'
import { unwrapSuccess } from '../lib/api/unwrap'
import { getRuntimeWebConfig } from '../lib/runtime/web-config.server'
import type { SitemapUrlsResponse } from '@howicc/contracts'

const STATIC_PATHS: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '0.8', changefreq: 'weekly' },
  { path: '/login', priority: '0.5', changefreq: 'monthly' },
]

const priorityFor = (type: string): string => {
  switch (type) {
    case 'public_profile':
      return '0.9'
    case 'shared_session':
      return '0.7'
    case 'public_repo':
      return '0.6'
    default:
      return '0.5'
  }
}

const changefreqFor = (type: string): string => {
  switch (type) {
    case 'public_profile':
      return 'daily'
    case 'shared_session':
      return 'weekly'
    case 'public_repo':
      return 'weekly'
    default:
      return 'monthly'
  }
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const GET: APIRoute = async ({ request }) => {
  const config = getRuntimeWebConfig()
  const origin = config.siteUrl.replace(/\/+$/, '')

  const api = createServerApiClient({
    baseUrl: config.apiServerUrl,
    cookie: request.headers.get('cookie'),
  })

  const response = await api.sitemap.getUrls().catch(() => null)
  const envelope = unwrapSuccess<SitemapUrlsResponse>(response)
  const entries = envelope?.entries ?? []

  const urls: string[] = []

  for (const entry of STATIC_PATHS) {
    urls.push(
      `<url><loc>${escapeXml(`${origin}${entry.path}`)}</loc><priority>${entry.priority}</priority><changefreq>${entry.changefreq}</changefreq></url>`,
    )
  }

  for (const entry of entries) {
    urls.push(
      [
        '<url>',
        `<loc>${escapeXml(`${origin}${entry.path}`)}</loc>`,
        entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '',
        `<priority>${priorityFor(entry.type)}</priority>`,
        `<changefreq>${changefreqFor(entry.type)}</changefreq>`,
        '</url>',
      ]
        .filter(Boolean)
        .join(''),
    )
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
