import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema, viewerSessionSchema, viewerUserSchema } from './shared'

export const viewerSessionResponseSchema = z
  .object({
    success: z.literal(true),
    authenticated: z.boolean(),
    session: viewerSessionSchema.nullable(),
    user: viewerUserSchema.nullable(),
  })
  .openapi('ViewerSessionResponse')

const viewerHtmlSchema = z.string().openapi({
  example: `<h2>Protected Content - You're In!</h2>`,
})

export const getViewerSessionRoute = createRoute({
  method: 'get',
  path: '/viewer/session',
  tags: ['Viewer'],
  summary: 'Get the current browser viewer session',
  description:
    'Returns a safe summary of the current Better Auth browser session. This endpoint is intended for SSR helpers, auth debugging, and browser-only integrations that need to confirm whether a session cookie is active.',
  operationId: 'getViewerSession',
  security: [{ BrowserSession: [] }],
  responses: {
    200: {
      description: 'Current viewer session summary or an unauthenticated empty state',
      content: {
        'application/json': {
          schema: viewerSessionResponseSchema,
        },
      },
    },
    500: {
      description: 'Session lookup failed unexpectedly',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const getViewerProtectedRoute = createRoute({
  method: 'get',
  path: '/viewer/protected',
  tags: ['Viewer'],
  summary: 'Load the protected viewer smoke-test page',
  description:
    'Returns a simple HTML page when the current browser session is authenticated. This route exists to smoke-test cookie-based auth from the web app and local environments.',
  operationId: 'getViewerProtected',
  security: [{ BrowserSession: [] }],
  responses: {
    200: {
      description: 'Protected HTML content rendered for an authenticated browser session',
      content: {
        'text/html': {
          schema: viewerHtmlSchema,
        },
      },
    },
    401: {
      description: 'The browser session is missing or invalid',
      content: {
        'text/html': {
          schema: viewerHtmlSchema,
        },
      },
    },
    500: {
      description: 'Viewer protected page failed unexpectedly',
      content: {
        'text/html': {
          schema: viewerHtmlSchema,
        },
      },
    },
  },
})
