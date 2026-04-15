import { OpenAPIHono } from '@hono/zod-openapi'
import { and, eq, isNull } from 'drizzle-orm'
import type { D1Client } from '@howicc/db/adapters/d1'
import { apiTokens, cliAuthGrants, users } from '@howicc/db/schema'
import {
  cliAuthAuthorizeRoute,
  cliAuthExchangeRoute,
  cliAuthWhoamiRoute,
} from '@howicc/contracts'
import { cors } from 'hono/cors'
import { type ApiAuthRuntimeEnv, createApiAuthContext } from '../lib/auth'
import {
  getBearerToken,
  sha256Base64Url,
  sha256Hex,
} from '../lib/cli-token-auth'
import { ApiError, toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

type CliAuthEnv = ApiAuthRuntimeEnv

app.use('/cli-auth/*', async (c, next) => {
  const runtimeEnv = c.env as CliAuthEnv

  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

app.openapi(cliAuthAuthorizeRoute, async c => {
  const runtimeEnv = c.env as CliAuthEnv
  const { db, auth } = createApiAuthContext(runtimeEnv)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json(
      toApiErrorPayload(
        'browserSessionRequired',
        'You must be signed in in the browser first.',
      ),
      401,
    )
  }

  const { callbackUrl, codeChallenge, state } = c.req.valid('json')

  if (!isValidCliCallback(callbackUrl)) {
    return c.json(
      toApiErrorPayload(
        'cliCallbackInvalid',
        'CLI callback URL must point to localhost or 127.0.0.1.',
      ),
      400,
    )
  }

  const code = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await db.insert(cliAuthGrants).values({
    id: `grant_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    codeHash: await sha256Hex(code),
    codeChallenge,
    callbackUrl,
    state,
    userId: session.user.id,
    expiresAt,
    createdAt: new Date(),
  })

  const redirectUrl = new URL(callbackUrl)
  redirectUrl.searchParams.set('code', code)
  redirectUrl.searchParams.set('state', state)

  return c.json(
    {
      success: true as const,
      redirectUrl: redirectUrl.toString(),
      expiresAt: expiresAt.toISOString(),
    },
    200,
  )
})

app.openapi(cliAuthExchangeRoute, async c => {
  try {
    const runtimeEnv = c.env as CliAuthEnv
    const { db } = createApiAuthContext(runtimeEnv)
    const { code, codeVerifier } = c.req.valid('json')
    const now = new Date()
    const codeHash = await sha256Hex(code)
    const grants = await db
      .select()
      .from(cliAuthGrants)
      .where(eq(cliAuthGrants.codeHash, codeHash))
      .limit(1)

    const grant = grants[0]

    if (
      !grant ||
      grant.consumedAt ||
      grant.expiresAt.getTime() < now.getTime()
    ) {
      throw new ApiError(
        'cliAuthGrantInvalid',
        'The CLI auth code is invalid or has expired.',
      )
    }

    if ((await sha256Base64Url(codeVerifier)) !== grant.codeChallenge) {
      throw new ApiError(
        'cliAuthGrantInvalid',
        'The CLI code verifier does not match the original challenge.',
      )
    }

    const token =
      `hwi_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
    const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const tokenHash = await sha256Hex(token)
    const nowMs = now.getTime()
    const d1Client = db.$client as D1Client

    // Worker D1 rejects Drizzle transaction(), so consume + insert must use batch().
    const batchResults = await d1Client.batch([
      d1Client
        .prepare(
          `UPDATE cli_auth_grants
           SET consumed_at = ?
           WHERE id = ?
             AND consumed_at IS NULL
             AND expires_at >= ?
             AND code_challenge = ?`,
        )
        .bind(nowMs, grant.id, nowMs, grant.codeChallenge),
      d1Client
        .prepare(
          `INSERT INTO api_tokens (id, user_id, token_prefix, token_hash, created_at)
           SELECT ?, user_id, ?, ?, ?
           FROM cli_auth_grants
           WHERE id = ?
             AND consumed_at = ?
           RETURNING user_id AS userId`,
        )
        .bind(tokenId, token.slice(0, 12), tokenHash, nowMs, grant.id, nowMs),
    ])

    const insertedUserId = getInsertedUserId(batchResults[1])

    if (!insertedUserId) {
      throw new ApiError(
        'cliAuthGrantInvalid',
        'The CLI auth code is invalid or has expired.',
      )
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, insertedUserId))
      .limit(1)

    const user = rows[0]

    if (!user) {
      throw new ApiError(
        'cliAuthUserMissing',
        'The user for this CLI login grant could not be found.',
      )
    }

    return c.json(
      {
        success: true as const,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    const status = response.status === 400 ? 400 : 500
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      status,
    )
  }
})

app.openapi(cliAuthWhoamiRoute, async c => {
  const runtimeEnv = c.env as CliAuthEnv
  const { db } = createApiAuthContext(runtimeEnv)
  const token = getBearerToken(c.req.header('Authorization'))

  if (!token) {
    return c.json(
      toApiErrorPayload('cliTokenInvalid', 'Missing Bearer token.'),
      401,
    )
  }

  const rows = await db
    .select({ userId: apiTokens.userId, email: users.email, name: users.name })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(and(eq(apiTokens.tokenHash, await sha256Hex(token)), isNull(apiTokens.revokedAt)))
    .limit(1)

  const row = rows[0]

  if (!row) {
    return c.json(
      toApiErrorPayload('cliTokenInvalid', 'Invalid or revoked CLI token.'),
      401,
    )
  }

  return c.json(
    {
      success: true as const,
      user: {
        id: row.userId,
        email: row.email,
        name: row.name,
      },
    },
    200,
  )
})

const isValidCliCallback = (value: string): boolean => {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
      Boolean(url.port)
    )
  } catch {
    return false
  }
}

type D1BatchResult = {
  results?: Array<Record<string, unknown>>
}

const getInsertedUserId = (result: unknown) => {
  const row = (result as D1BatchResult | undefined)?.results?.[0]
  return typeof row?.userId === 'string' ? row.userId : undefined
}

export default app
