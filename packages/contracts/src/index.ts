import { OpenAPIHono } from '@hono/zod-openapi'
import { cliAuthAuthorizeRoute, cliAuthExchangeRoute, cliAuthWhoamiRoute } from './cli-auth'
import {
  getArtifactRoute,
  getAssetPreviewRoute,
  getRenderDocumentRoute,
  getSharedRenderDocumentRoute,
  listConversationsRoute,
  updateConversationVisibilityRoute,
} from './conversations'
import { healthRoute } from './health'
import { openRouterModelsRoute } from './pricing'
import {
  getProfileActivityRoute,
  getProfileRoute,
  getProfileStatsRoute,
  recomputeProfileRoute,
} from './profile'
import { getRepoProfileRoute } from './repo'
import {
  createUploadSessionRoute,
  finalizeRevisionRoute,
  uploadRevisionAssetRoute,
} from './uploads'
import { getViewerProtectedRoute, getViewerSessionRoute } from './viewer'

export * from './shared'
export * from './errors'
export * from './health'
export * from './uploads'
export * from './conversations'
export * from './pricing'
export * from './cli-auth'
export * from './profile'
export * from './repo'
export * from './viewer'

const contractHandler = (() => {
  throw new Error('Contract handler should never run at runtime')
}) as never

const app = new OpenAPIHono()

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

export const routes = app
  .openapi(healthRoute, contractHandler)
  .openapi(createUploadSessionRoute, contractHandler)
  .openapi(uploadRevisionAssetRoute, contractHandler)
  .openapi(finalizeRevisionRoute, contractHandler)
  .openapi(listConversationsRoute, contractHandler)
  .openapi(getRenderDocumentRoute, contractHandler)
  .openapi(getSharedRenderDocumentRoute, contractHandler)
  .openapi(updateConversationVisibilityRoute, contractHandler)
  .openapi(getArtifactRoute, contractHandler)
  .openapi(getAssetPreviewRoute, contractHandler)
  .openapi(openRouterModelsRoute, contractHandler)
  .openapi(cliAuthAuthorizeRoute, contractHandler)
  .openapi(cliAuthExchangeRoute, contractHandler)
  .openapi(cliAuthWhoamiRoute, contractHandler)
  .openapi(getProfileRoute, contractHandler)
  .openapi(getProfileStatsRoute, contractHandler)
  .openapi(getProfileActivityRoute, contractHandler)
  .openapi(recomputeProfileRoute, contractHandler)
  .openapi(getRepoProfileRoute, contractHandler)
  .openapi(getViewerSessionRoute, contractHandler)
  .openapi(getViewerProtectedRoute, contractHandler)

export type AppType = typeof routes
