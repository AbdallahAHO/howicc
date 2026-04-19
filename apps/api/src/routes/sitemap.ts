import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  conversations,
  repos,
  sessionDigests,
  users,
} from '@howicc/db/schema'
import { getSitemapUrlsRoute, type SitemapEntry } from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import type { ApiAuthRuntimeEnv } from '../lib/auth'
import { getRuntimeDatabase } from '../lib/runtime-resources'
import { toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

type SitemapRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: SitemapRouteEnv) => createApiRuntime(env as never)

app.use('/sitemap/*', async (c, next) => {
  const runtimeEnv = c.env as SitemapRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'OPTIONS'],
    maxAge: 600,
  })(c, next)
})

app.openapi(getSitemapUrlsRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as SitemapRouteEnv
    const runtime = getRuntime(runtimeEnv)
    const db = getRuntimeDatabase(runtime)

    // Public profiles
    const publicUsers = await db
      .select({
        username: users.username,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.publicProfileEnabled, true))
      .orderBy(desc(users.updatedAt))
      .limit(5000)

    // Public shared conversations
    const publicShared = await db
      .select({
        slug: conversations.slug,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.visibility, 'public'))
      .orderBy(desc(conversations.updatedAt))
      .limit(5000)

    // Public repos: repos that either have a row with visibility=public OR
    // no row at all (default is public). We surface the distinct repository
    // identifiers from session digests joined with public conversations,
    // then exclude repos explicitly marked private/members.
    const repoRows = await db
      .selectDistinct({
        repository: sessionDigests.repository,
      })
      .from(sessionDigests)
      .innerJoin(conversations, eq(conversations.id, sessionDigests.conversationId))
      .where(
        and(
          isNotNull(sessionDigests.repository),
          eq(conversations.visibility, 'public'),
          eq(sessionDigests.revisionId, conversations.currentRevisionId),
        ),
      )
      .limit(5000)

    const gatedRepos = await db
      .select({
        owner: repos.owner,
        name: repos.name,
        visibility: repos.visibility,
      })
      .from(repos)

    const gatedKeys = new Set(
      gatedRepos
        .filter(r => r.visibility !== 'public')
        .map(r => `${r.owner}/${r.name}`),
    )

    const entries: SitemapEntry[] = []

    for (const row of publicUsers) {
      if (!row.username) continue
      entries.push({
        type: 'public_profile',
        path: `/${row.username}`,
        lastmod: row.updatedAt.toISOString(),
      })
    }

    for (const row of publicShared) {
      entries.push({
        type: 'shared_session',
        path: `/s/${row.slug}`,
        lastmod: row.updatedAt.toISOString(),
      })
    }

    for (const row of repoRows) {
      const full = row.repository
      if (!full) continue
      if (gatedKeys.has(full)) continue
      const [owner, name] = full.split('/')
      if (!owner || !name) continue
      entries.push({
        type: 'public_repo',
        path: `/r/${owner}/${name}`,
      })
    }

    return c.json({ success: true as const, entries }, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

// Silences unused import in environments that tree-shake `sql`
void sql

export default app
