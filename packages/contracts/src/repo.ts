import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema, repoProfileSchema } from './shared'

const repoParamsSchema = z.object({
  owner: z.string().openapi({
    param: {
      name: 'owner',
      in: 'path',
    },
    example: 'openai',
    description: 'Repository owner or organization slug.',
  }),
  name: z.string().openapi({
    param: {
      name: 'name',
      in: 'path',
    },
    example: 'openai-node',
    description: 'Repository name.',
  }),
})

export const repoProfileResponseSchema = z
  .object({
    success: z.literal(true),
    repository: z.string().openapi({
      example: 'openai/openai-node',
    }),
    profile: repoProfileSchema.nullable(),
    sessionCount: z.number().int().nonnegative(),
    message: z.string().optional(),
  })
  .openapi('RepoProfileResponse')

export type RepoProfileResponse = z.infer<typeof repoProfileResponseSchema>

export const getRepoProfileRoute = createRoute({
  method: 'get',
  path: '/repo/{owner}/{name}',
  tags: ['Repositories'],
  summary: 'Get the public aggregate profile for a repository',
  description:
    'Aggregates the current public conversation digests for the requested repository across all users. Only conversations whose current revision is publicly visible are included in the result.',
  operationId: 'getRepoProfile',
  request: {
    params: repoParamsSchema,
  },
  responses: {
    200: {
      description: 'Repository profile or an empty state when no public sessions exist',
      content: {
        'application/json': {
          schema: repoProfileResponseSchema,
        },
      },
    },
    400: {
      description: 'The repository owner or name contains unsupported characters',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Repository profile aggregation failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
