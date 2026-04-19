import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { and, eq, sql } from 'drizzle-orm'
import { conversations, conversationViews } from '@howicc/db/schema'
import { recordSessionViewRoute } from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import { getRuntimeDatabase } from '../lib/runtime-resources'
import { deriveViewerKey } from '../lib/viewer-key'

const app = new OpenAPIHono()

type ViewsRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: ViewsRouteEnv) => createApiRuntime(env as never)

app.use('/sessions/*', async (c, next) => {
  const runtimeEnv = c.env as ViewsRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type'],
    allowMethods: ['POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  })(c, next)
})

app.openapi(recordSessionViewRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as ViewsRouteEnv
    const conversationId = c.req.param('conversationId')

    const runtime = getRuntime(runtimeEnv)
    const db = getRuntimeDatabase(runtime)

    const rows = await db
      .select({
        id: conversations.id,
        ownerUserId: conversations.ownerUserId,
        visibility: conversations.visibility,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    const conv = rows[0]
    if (!conv) {
      return c.json(
        toApiErrorPayload('conversationNotFound', 'Conversation not found.'),
        404,
      )
    }

    // Private conversations cannot be viewed without owner auth; even the
    // counter stays silent so we don't leak existence.
    if (conv.visibility === 'private') {
      return c.json(
        toApiErrorPayload('conversationNotFound', 'Conversation not found.'),
        404,
      )
    }

    // Owners don't inflate their own counter.
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(
      () => null,
    )
    const viewerUserId = session?.user.id ?? null
    const isOwner = viewerUserId !== null && viewerUserId === conv.ownerUserId

    const viewCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversationViews)
      .where(eq(conversationViews.conversationId, conv.id))
    const existingCount = Number(viewCountRows[0]?.count ?? 0)

    if (isOwner) {
      return c.json(
        { success: true as const, recorded: false, viewCount: existingCount },
        200,
      )
    }

    const viewerKey = await deriveViewerKey(c.req.raw, runtimeEnv, viewerUserId)
    const now = new Date()
    const day = now.toISOString().slice(0, 10)

    const existing = await db
      .select({ id: conversationViews.id })
      .from(conversationViews)
      .where(
        and(
          eq(conversationViews.conversationId, conv.id),
          eq(conversationViews.viewerKey, viewerKey),
          eq(conversationViews.day, day),
        ),
      )
      .limit(1)

    if (existing[0]) {
      return c.json(
        { success: true as const, recorded: false, viewCount: existingCount },
        200,
      )
    }

    await db.insert(conversationViews).values({
      id: crypto.randomUUID(),
      conversationId: conv.id,
      viewerKey,
      viewedAt: now,
      day,
    })

    return c.json(
      {
        success: true as const,
        recorded: true,
        viewCount: existingCount + 1,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

export default app
