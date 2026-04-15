import { createRoute } from '@hono/zod-openapi'
import {
  cliAuthAuthorizeBodySchema,
  cliAuthAuthorizeResponseSchema,
  cliAuthExchangeBodySchema,
  cliAuthExchangeResponseSchema,
  cliAuthWhoamiResponseSchema,
  errorResponseSchema,
} from './shared'

export const cliAuthAuthorizeRoute = createRoute({
  method: 'post',
  path: '/cli-auth/authorize',
  tags: ['CLI Auth'],
  summary: 'Create a one-time browser-authenticated CLI login grant',
  description:
    'Creates a short-lived authorization grant for the local CLI login flow. The caller must already have a valid Better Auth browser session cookie.',
  operationId: 'authorizeCliSession',
  security: [{ BrowserSession: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: cliAuthAuthorizeBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'CLI auth grant created',
      content: {
        'application/json': {
          schema: cliAuthAuthorizeResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid callback or request payload',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Browser session is not authenticated',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const cliAuthExchangeRoute = createRoute({
  method: 'post',
  path: '/cli-auth/exchange',
  tags: ['CLI Auth'],
  summary: 'Exchange a one-time CLI auth code for an API token',
  description:
    'Consumes a previously issued one-time CLI grant and returns a bearer token for subsequent CLI API calls.',
  operationId: 'exchangeCliGrant',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: cliAuthExchangeBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'CLI token issued',
      content: {
        'application/json': {
          schema: cliAuthExchangeResponseSchema,
        },
      },
    },
    400: {
      description: 'Grant is invalid or expired',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const cliAuthWhoamiRoute = createRoute({
  method: 'get',
  path: '/cli-auth/whoami',
  tags: ['CLI Auth'],
  summary: 'Resolve the current CLI token to the owning user',
  description:
    'Validates the bearer token presented by the CLI and returns the owning user record.',
  operationId: 'getCliTokenOwner',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'CLI token user',
      content: {
        'application/json': {
          schema: cliAuthWhoamiResponseSchema,
        },
      },
    },
    401: {
      description: 'Missing or invalid CLI token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
