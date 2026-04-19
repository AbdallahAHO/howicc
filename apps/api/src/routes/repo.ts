import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { getRepoProfileRoute } from '@howicc/contracts'
import {
  getRepoProfile,
  getPublicRepoDigestCount,
} from '../modules/profile/service'
import { createApiRuntime } from '../runtime'
import { toApiErrorPayload, toApiErrorResponse } from '../lib/api-error'

const app = new OpenAPIHono()

type RepoRouteEnv = {
  WEB_APP_URL: string
  DB: unknown
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
}

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
  })(c, next)
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
    const publicCount = await getPublicRepoDigestCount(runtime, repositoryFullName)

    if (publicCount === 0) {
      return c.json(
        {
          success: true as const,
          repository: repositoryFullName,
          profile: null,
          sessionCount: 0,
          visibility: 'public' as const,
          message: 'No public sessions found for this repository.',
        },
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
        visibility: 'public' as const,
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
