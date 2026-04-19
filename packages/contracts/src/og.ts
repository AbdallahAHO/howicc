import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema } from './shared'

export const getProfileOgImageRoute = createRoute({
  method: 'get',
  path: '/og/u/{username}.png',
  tags: ['Open Graph'],
  summary: 'Render the Open Graph card for a public profile',
  description:
    "Server-renders a 1200x630 PNG social card for the public profile at `/{username}`. Generated on demand with satori + resvg-wasm, cached at the edge for 1 hour and persisted in R2. Always responds with an image — on internal error, a static fallback card is served instead of an HTTP error, so social crawlers never see a 500.",
  operationId: 'getProfileOgImage',
  request: {
    params: z.object({
      username: z.string().openapi({
        param: { name: 'username', in: 'path' },
        description: 'Lowercased GitHub login (path segment ends in `.png`).',
        example: 'abdallahali',
      }),
    }),
  },
  responses: {
    200: {
      description: '1200x630 PNG social card',
      content: {
        'image/png': {
          schema: z.string().openapi({
            format: 'binary',
            description: 'PNG bytes.',
          }),
        },
      },
    },
    404: {
      description: 'Unknown user or profile is not public',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})
