import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { and, eq } from 'drizzle-orm'
import { accounts, users } from '@howicc/db/schema'
import {
  getRepoConsentStatusRoute,
  getRepoSettingsRoute,
  hideRepoConversationRoute,
  previewRepoVisibilityRoute,
  recordRepoConsentRequestSchema,
  recordRepoConsentRoute,
  repoAdminPermissionValues,
  repoVisibilitySchema,
  unhideRepoConversationRoute,
  updateRepoVisibilityRequestSchema,
  updateRepoVisibilityRoute,
  type RepoAdminPermission,
} from '@howicc/contracts'
import { createApiRuntime } from '../runtime'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'
import { getRuntimeDatabase } from '../lib/runtime-resources'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import {
  permissionAtLeast,
  resolveRepoPermission,
  type GithubPermission,
} from '../lib/github-permissions'
import {
  consentIsFresh,
  consentShouldBeRequested,
  getRepoSettingsRow,
  hideConversationFromRepo,
  listHiddenConversationsForRepo,
  previewAggregatedConversations,
  recordConsent,
  signPreviewToken,
  unhideConversationFromRepo,
  upsertRepoVisibility,
  verifyPreviewToken,
} from '../modules/repo-admin/service'

const app = new OpenAPIHono()

type RepoAdminRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: RepoAdminRouteEnv) => createApiRuntime(env as never)

app.use('/repo/*', async (c, next) => {
  const runtimeEnv = c.env as RepoAdminRouteEnv
  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

const toApiPermission = (p: GithubPermission): RepoAdminPermission => {
  return (repoAdminPermissionValues as readonly string[]).includes(p)
    ? (p as RepoAdminPermission)
    : 'none'
}

const requireAdmin = async (
  runtimeEnv: RepoAdminRouteEnv,
  runtime: ReturnType<typeof getRuntime>,
  headers: Headers,
  owner: string,
  name: string,
): Promise<
  | { ok: true; userId: string; login: string; permission: GithubPermission }
  | { ok: false; status: 401 | 403 }
> => {
  const auth = createApiAuth(runtimeEnv)
  const session = await auth.api.getSession({ headers })
  if (!session?.user.id) return { ok: false, status: 401 }

  const db = getRuntimeDatabase(runtime)
  const [userRow] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!userRow?.username) return { ok: false, status: 401 }

  const permission = await resolveRepoPermission(runtime, {
    userId: session.user.id,
    login: userRow.username,
    owner,
    name,
  })

  if (!permissionAtLeast(permission, 'maintain')) {
    return { ok: false, status: 403 }
  }

  return { ok: true, userId: session.user.id, login: userRow.username, permission }
}

app.openapi(getRepoSettingsRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const settings = await getRepoSettingsRow(runtime, owner, name)
    const hidden = await listHiddenConversationsForRepo(runtime, owner, name)
    const consentRequired = await consentShouldBeRequested(runtime, {
      owner,
      name,
      userId: gate.userId,
    })

    return c.json(
      {
        success: true as const,
        repository: `${owner}/${name}`,
        visibility: settings.visibility,
        updatedBy: settings.updatedByUserId,
        updatedAt: settings.updatedAt?.toISOString(),
        viewerPermission: toApiPermission(gate.permission),
        hidden,
        consentRequired,
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

app.openapi(getRepoConsentStatusRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')
    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const required = await consentShouldBeRequested(runtime, {
      owner,
      name,
      userId: gate.userId,
    })
    const consent = await consentIsFresh(runtime, {
      owner,
      name,
      userId: gate.userId,
    })

    return c.json(
      {
        success: true as const,
        consentRequired: required,
        consentedAt: consent.consentedAt?.toISOString(),
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

app.openapi(recordRepoConsentRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')

    const body = await c.req.json().catch(() => null)
    const parsed = recordRepoConsentRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        toApiErrorPayload('validationFailed', 'Invalid consent payload.'),
        400,
      )
    }

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const consentedAt = await recordConsent(runtime, {
      owner,
      name,
      userId: gate.userId,
    })

    return c.json(
      { success: true as const, consentedAt: consentedAt.toISOString() },
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

app.openapi(previewRepoVisibilityRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')
    const target = c.req.query('target')
    const parsedTarget = repoVisibilitySchema.safeParse(target)
    if (!parsedTarget.success) {
      return c.json(
        toApiErrorPayload('validationFailed', 'Invalid target visibility.'),
        400,
      )
    }

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const current = await getRepoSettingsRow(runtime, owner, name)
    const items = await previewAggregatedConversations(runtime, {
      owner,
      name,
      target: parsedTarget.data,
    })

    const secret = runtimeEnv.BETTER_AUTH_SECRET ?? 'howicc-dev-preview-token'
    const previewToken = await signPreviewToken(secret, {
      owner,
      name,
      target: parsedTarget.data,
      userId: gate.userId,
    })

    return c.json(
      {
        success: true as const,
        repository: `${owner}/${name}`,
        currentVisibility: current.visibility,
        targetVisibility: parsedTarget.data,
        wouldAggregateCount: items.length,
        items,
        previewToken,
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

app.openapi(updateRepoVisibilityRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')

    const body = await c.req.json().catch(() => null)
    const parsed = updateRepoVisibilityRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        toApiErrorPayload('validationFailed', 'Invalid visibility payload.'),
        400,
      )
    }

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const current = await getRepoSettingsRow(runtime, owner, name)
    if (current.visibility === 'private') {
      const consent = await consentIsFresh(runtime, {
        owner,
        name,
        userId: gate.userId,
      })
      if (!consent.fresh) {
        return c.json(
          toApiErrorPayload(
            'consentRequired',
            'Admin must acknowledge the private-repo notice within the last 24h.',
          ),
          400,
        )
      }
    }

    const secret = runtimeEnv.BETTER_AUTH_SECRET ?? 'howicc-dev-preview-token'
    const tokenValid = await verifyPreviewToken(secret, parsed.data.previewToken, {
      owner,
      name,
      target: parsed.data.visibility,
      userId: gate.userId,
    })
    if (!tokenValid) {
      return c.json(
        toApiErrorPayload(
          'previewTokenInvalid',
          'Preview token is missing, expired, or does not match the requested visibility.',
        ),
        400,
      )
    }

    const updatedAt = await upsertRepoVisibility(runtime, {
      owner,
      name,
      visibility: parsed.data.visibility,
      userId: gate.userId,
    })

    return c.json(
      {
        success: true as const,
        repository: `${owner}/${name}`,
        visibility: parsed.data.visibility,
        updatedAt: updatedAt.toISOString(),
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

app.openapi(hideRepoConversationRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')
    const conversationId = c.req.param('conversationId')

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const current = await getRepoSettingsRow(runtime, owner, name)
    if (current.visibility === 'private') {
      const consent = await consentIsFresh(runtime, {
        owner,
        name,
        userId: gate.userId,
      })
      if (!consent.fresh) {
        return c.json(
          toApiErrorPayload(
            'consentRequired',
            'Admin must acknowledge the private-repo notice within the last 24h.',
          ),
          400,
        )
      }
    }

    const result = await hideConversationFromRepo(runtime, {
      owner,
      name,
      conversationId,
      userId: gate.userId,
    })

    if (!result.found || !result.hiddenAt) {
      return c.json(
        toApiErrorPayload(
          'conversationNotInRepo',
          'That conversation is not linked to this repository.',
        ),
        404,
      )
    }

    return c.json(
      {
        success: true as const,
        conversationId,
        hiddenAt: result.hiddenAt.toISOString(),
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

app.openapi(unhideRepoConversationRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoAdminRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')
    const conversationId = c.req.param('conversationId')

    const runtime = getRuntime(runtimeEnv)
    const gate = await requireAdmin(runtimeEnv, runtime, c.req.raw.headers, owner, name)
    if (!gate.ok) {
      if (gate.status === 401) {
        return c.json(toApiErrorPayload('authRequired', 'Authentication required.'), 401)
      }
      return c.json(
        toApiErrorPayload('repoPermissionDenied', 'You need repo admin access.'),
        403,
      )
    }

    const current = await getRepoSettingsRow(runtime, owner, name)
    if (current.visibility === 'private') {
      const consent = await consentIsFresh(runtime, {
        owner,
        name,
        userId: gate.userId,
      })
      if (!consent.fresh) {
        return c.json(
          toApiErrorPayload(
            'consentRequired',
            'Admin must acknowledge the private-repo notice within the last 24h.',
          ),
          400,
        )
      }
    }

    const removed = await unhideConversationFromRepo(runtime, {
      owner,
      name,
      conversationId,
    })

    if (!removed) {
      return c.json(
        toApiErrorPayload(
          'hiddenConversationMissing',
          'That conversation was not hidden from repo aggregation.',
        ),
        404,
      )
    }

    return c.json({ success: true as const, conversationId }, 200)
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      { success: false, code: response.code, error: response.error },
      500,
    )
  }
})

// Used only to avoid lint warning about unused imports in some branches
void accounts
void and

export default app
