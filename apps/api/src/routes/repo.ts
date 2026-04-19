import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { and, eq } from 'drizzle-orm'
import { repoHiddenConversations, users } from '@howicc/db/schema'
import { getRepoProfileRoute, type RepoVisibility } from '@howicc/contracts'
import {
  getRepoProfile,
  getPublicRepoDigestCount,
} from '../modules/profile/service'
import {
  getRepoSettingsRow,
} from '../modules/repo-admin/service'
import { createApiRuntime } from '../runtime'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'
import { createApiAuth, type ApiAuthRuntimeEnv } from '../lib/auth'
import { getRuntimeDatabase } from '../lib/runtime-resources'
import {
  permissionAtLeast,
  resolveRepoPermission,
} from '../lib/github-permissions'

const app = new OpenAPIHono()

type RepoRouteEnv = {
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
} & ApiAuthRuntimeEnv

const getRuntime = (env: RepoRouteEnv) =>
  createApiRuntime(env as never)

app.use('/repo/*', async (c, next) => {
  const runtimeEnv = c.env as RepoRouteEnv

  return cors({
    origin: runtimeEnv.WEB_APP_URL,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next)
})

const resolveViewerPermission = async (
  runtime: ReturnType<typeof getRuntime>,
  runtimeEnv: RepoRouteEnv,
  headers: Headers,
  owner: string,
  name: string,
): Promise<'none' | 'read' | 'write' | 'maintain' | 'admin'> => {
  try {
    const auth = createApiAuth(runtimeEnv)
    const session = await auth.api.getSession({ headers })
    if (!session?.user.id) return 'none'

    const db = getRuntimeDatabase(runtime)
    const [userRow] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!userRow?.username) return 'none'

    return resolveRepoPermission(runtime, {
      userId: session.user.id,
      login: userRow.username,
      owner,
      name,
    })
  } catch {
    return 'none'
  }
}

const emptyResponse = (
  repositoryFullName: string,
  visibility: RepoVisibility,
  message: string,
) => ({
  success: true as const,
  repository: repositoryFullName,
  profile: null,
  sessionCount: 0,
  visibility,
  message,
})

app.openapi(getRepoProfileRoute, async c => {
  try {
    const runtimeEnv = c.env as unknown as RepoRouteEnv
    const owner = c.req.param('owner')
    const name = c.req.param('name')

    const validRepoSegment = /^[a-zA-Z0-9_.-]{1,100}$/
    if (!validRepoSegment.test(owner) || !validRepoSegment.test(name)) {
      return c.json(
        toApiErrorPayload(
          'repoIdentifierInvalid',
          'Invalid repository owner or name.',
        ),
        400,
      )
    }

    const repositoryFullName = `${owner}/${name}`
    const runtime = getRuntime(runtimeEnv)

    const settings = await getRepoSettingsRow(runtime, owner, name)
    const viewerPermission = await resolveViewerPermission(
      runtime,
      runtimeEnv,
      c.req.raw.headers,
      owner,
      name,
    )
    const viewerIsAdmin = permissionAtLeast(viewerPermission, 'maintain')
    const viewerIsMember = permissionAtLeast(viewerPermission, 'read')

    // Private repos: no aggregation exposed to anyone. Admins still see the
    // empty-state + adminHiddenCount so they can jump into settings.
    if (settings.visibility === 'private') {
      let adminHiddenCount: number | undefined
      if (viewerIsAdmin) {
        const db = getRuntimeDatabase(runtime)
        const rows = await db
          .select({ id: repoHiddenConversations.conversationId })
          .from(repoHiddenConversations)
          .where(
            and(
              eq(repoHiddenConversations.owner, owner),
              eq(repoHiddenConversations.name, name),
            ),
          )
        adminHiddenCount = rows.length
      }
      return c.json(
        {
          ...emptyResponse(
            repositoryFullName,
            'private',
            'This repository is marked private by its admin. Aggregate stats are hidden.',
          ),
          ...(adminHiddenCount !== undefined ? { adminHiddenCount } : {}),
        },
        200,
      )
    }

    // Members tier: must have at least read access on GitHub.
    if (settings.visibility === 'members' && !viewerIsMember) {
      return c.json(
        emptyResponse(
          repositoryFullName,
          'members',
          'This repository is restricted to members. Sign in with a collaborator account on GitHub to see aggregate stats.',
        ),
        200,
      )
    }

    const publicCount = await getPublicRepoDigestCount(runtime, repositoryFullName)

    if (publicCount === 0) {
      return c.json(
        emptyResponse(
          repositoryFullName,
          settings.visibility,
          'No public sessions found for this repository.',
        ),
        200,
      )
    }

    const profile = await getRepoProfile(runtime, repositoryFullName)

    if (!profile) {
      return c.json(
        toApiErrorPayload(
          'internalError',
          'Repository profile could not be computed.',
        ),
        500,
      )
    }

    return c.json(
      {
        success: true as const,
        repository: repositoryFullName,
        profile,
        sessionCount: publicCount,
        visibility: settings.visibility,
      },
      200,
    )
  } catch (error) {
    const response = toApiErrorResponse(error, 'internalError')
    return c.json(
      {
        success: false,
        code: response.code,
        error: response.error,
      },
      response.status === 400 ? 400 : 500,
    )
  }
})

export default app
