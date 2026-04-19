import { OpenAPIHono } from '@hono/zod-openapi'
import { getProfileOgImageRoute, isValidPublicUsername } from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import type { ApiAuthRuntimeEnv } from '../lib/auth'
import { getPublicProfile } from '../modules/public-profile/service'

// OG renderer helpers are loaded lazily so Node-based unit tests (vitest)
// don't try to parse yoga.wasm at import time. Everything under
// `../modules/og/*` transitively imports `workers-og`, which ships wasm that
// the Node test runtime can't resolve. On Cloudflare Workers the dynamic
// import resolves at first request and stays hot for subsequent calls.
const loadOgModules = () =>
  Promise.all([
    import('../modules/og/cache'),
    import('../modules/og/fallback'),
    import('../modules/og/profile-card'),
  ])

const app = new OpenAPIHono()

type OgRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: OgRouteEnv) => createApiRuntime(env as never)

const IMAGE_HEADERS: Record<string, string> = {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  'X-Robots-Tag': 'noindex',
}

const FALLBACK_HEADERS: Record<string, string> = {
  'Content-Type': 'image/png',
  // Short TTL so crawlers retry soon — the fallback is a sentinel, not the
  // intended image.
  'Cache-Control': 'public, max-age=60, s-maxage=60',
  'X-Robots-Tag': 'noindex',
}

type WaitUntilContext = { waitUntil: (promise: Promise<unknown>) => void }

app.openapi(getProfileOgImageRoute, async c => {
  const modules = await loadOgModules().catch(() => null)

  if (!modules) {
    // If the OG modules can't load (e.g., wasm init fails), use a minimal
    // inline 1x1 transparent PNG so crawlers don't see a 500.
    const tiny = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 1, 3, 0, 0, 0, 37, 219, 86, 202, 0, 0, 0, 3, 80, 76, 84, 69,
      0, 0, 0, 167, 122, 61, 218, 0, 0, 0, 1, 116, 82, 78, 83, 0, 64, 230, 216,
      102, 0, 0, 0, 10, 73, 68, 65, 84, 8, 215, 99, 96, 0, 0, 0, 2, 0, 1, 226,
      33, 188, 51, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ])
    return new Response(tiny, { status: 200, headers: FALLBACK_HEADERS })
  }

  const [cacheModule, fallbackModule, rendererModule] = modules
  const { buildProfileCardCacheKey, readCachedProfileCard, writeCachedProfileCard } =
    cacheModule
  const { getFallbackOgBytes } = fallbackModule
  const { renderProfileCardPng } = rendererModule

  const respondFallback = () =>
    new Response(getFallbackOgBytes(), { status: 200, headers: FALLBACK_HEADERS })

  try {
    const runtimeEnv = c.env as unknown as OgRouteEnv
    const runtime = getRuntime(runtimeEnv)

    const rawUsername = c.req.param('username') ?? ''
    const username = rawUsername.toLowerCase()

    // Never 500 this route for an OG crawler. Always return an image.
    if (!isValidPublicUsername(username)) return respondFallback()

    const profile = await getPublicProfile(runtime, username)
    if (!profile) return respondFallback()

    const cardInput = {
      username: profile.user.username,
      displayName: profile.user.displayName,
      avatarUrl: profile.user.avatarUrl,
      sessionCount: profile.stats.sessionCount,
      totalDurationMs: profile.stats.totalDurationMs,
      currentStreak: profile.stats.currentStreak,
    }

    const cacheKey = await buildProfileCardCacheKey(cardInput)
    const cached = await readCachedProfileCard(runtime, cacheKey)
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { ...IMAGE_HEADERS, 'X-Og-Cache': 'hit' },
      })
    }

    const rendered = await renderProfileCardPng(cardInput)
    if (!rendered) return respondFallback()

    // Fire-and-forget cache write — don't block the response on R2 put.
    const executionCtx = (c.executionCtx ?? null) as WaitUntilContext | null
    const writePromise = writeCachedProfileCard(runtime, cacheKey, rendered)
    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      executionCtx.waitUntil(writePromise)
    } else {
      void writePromise
    }

    return new Response(rendered, {
      status: 200,
      headers: { ...IMAGE_HEADERS, 'X-Og-Cache': 'miss' },
    })
  } catch {
    return respondFallback()
  }
})

export default app
