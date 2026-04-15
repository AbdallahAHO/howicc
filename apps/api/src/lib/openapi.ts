import { OpenAPIHono } from '@hono/zod-openapi'
import { getApiErrorDefinition } from '@howicc/contracts'

export const createOpenApiRouter = () => {
  const validationError = getApiErrorDefinition('validationFailed')
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            code: validationError.code,
            error: result.error.issues.map(issue => issue.message).join(', '),
          },
          validationError.httpStatus,
        )
      }
    },
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'opaque',
    description: 'CLI bearer token issued by the `/cli-auth/exchange` flow.',
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'BrowserSession', {
    type: 'apiKey',
    in: 'cookie',
    name: '__Secure-howicc.session_token',
    description:
      'Better Auth browser session cookie. Local HTTP development uses `howicc.session_token` without the `__Secure-` prefix.',
  })

  return app
}
