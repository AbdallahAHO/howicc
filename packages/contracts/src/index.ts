import { OpenAPIHono } from '@hono/zod-openapi'
import {
  createApiTokenRoute,
  listApiTokensRoute,
  revokeApiTokenRoute,
} from './api-tokens'
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
import { getProfileOgImageRoute } from './og'
import { openRouterModelsRoute } from './pricing'
import {
  getProfileActivityRoute,
  getProfileRoute,
  getProfileStatsRoute,
  recomputeProfileRoute,
} from './profile'
import {
  getPublicProfileMineRoute,
  getPublicProfileRoute,
  recordPublicProfileViewRoute,
  updatePublicProfileSettingsRoute,
} from './public-profile'
import {
  getRepoConsentStatusRoute,
  getRepoProfileRoute,
  getRepoSettingsRoute,
  hideRepoConversationRoute,
  previewRepoVisibilityRoute,
  recordRepoConsentRoute,
  unhideRepoConversationRoute,
  updateRepoVisibilityRoute,
} from './repo'
import { getSitemapUrlsRoute } from './sitemap'
import {
  createUploadSessionRoute,
  finalizeRevisionRoute,
  uploadRevisionAssetRoute,
} from './uploads'
import { recordSessionViewRoute } from './views'
import { getViewerProtectedRoute, getViewerSessionRoute } from './viewer'

export * from './shared'
export * from './errors'
export * from './health'
export * from './uploads'
export * from './conversations'
export * from './pricing'
export * from './cli-auth'
export * from './api-tokens'
export * from './profile'
export * from './public-profile'
export * from './repo'
export * from './views'
export * from './og'
export * from './reserved-usernames'
export * from './sitemap'
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
  .openapi(listApiTokensRoute, contractHandler)
  .openapi(createApiTokenRoute, contractHandler)
  .openapi(revokeApiTokenRoute, contractHandler)
  .openapi(getProfileRoute, contractHandler)
  .openapi(getProfileStatsRoute, contractHandler)
  .openapi(getProfileActivityRoute, contractHandler)
  .openapi(recomputeProfileRoute, contractHandler)
  .openapi(getPublicProfileRoute, contractHandler)
  .openapi(getPublicProfileMineRoute, contractHandler)
  .openapi(updatePublicProfileSettingsRoute, contractHandler)
  .openapi(recordPublicProfileViewRoute, contractHandler)
  .openapi(getRepoProfileRoute, contractHandler)
  .openapi(getRepoSettingsRoute, contractHandler)
  .openapi(getRepoConsentStatusRoute, contractHandler)
  .openapi(recordRepoConsentRoute, contractHandler)
  .openapi(previewRepoVisibilityRoute, contractHandler)
  .openapi(updateRepoVisibilityRoute, contractHandler)
  .openapi(hideRepoConversationRoute, contractHandler)
  .openapi(unhideRepoConversationRoute, contractHandler)
  .openapi(recordSessionViewRoute, contractHandler)
  .openapi(getProfileOgImageRoute, contractHandler)
  .openapi(getSitemapUrlsRoute, contractHandler)
  .openapi(getViewerSessionRoute, contractHandler)
  .openapi(getViewerProtectedRoute, contractHandler)

export type AppType = typeof routes
