import { apiReference } from '@scalar/hono-api-reference'
import authRoutes from './routes/auth'
import cliAuthRoutes from './routes/cliAuth'
import conversationsRoutes from './routes/conversations'
import healthRoutes from './routes/health'
import { createOpenApiRouter } from './lib/openapi'
import pricingRoutes from './routes/pricing'
import profileRoutes from './routes/profile'
import repoRoutes from './routes/repo'
import uploadsRoutes from './routes/uploads'
import viewerRoutes from './routes/viewer'

export const createApp = () => {
  const app = createOpenApiRouter()

  app.route('/', healthRoutes)
  app.route('/', authRoutes)
  app.route('/', cliAuthRoutes)
  app.route('/', uploadsRoutes)
  app.route('/', conversationsRoutes)
  app.route('/', pricingRoutes)
  app.route('/', profileRoutes)
  app.route('/', repoRoutes)
  app.route('/', viewerRoutes)

  app.doc('/openapi.json', c => ({
    openapi: '3.1.0',
    info: {
      title: 'HowiCC API',
      version: '0.0.1',
      description:
        'Contract-first API for syncing, storing, profiling, and rendering agent conversations. Browser integrations use Better Auth session cookies, while the CLI uses bearer tokens issued through the CLI auth exchange flow.',
    },
    servers: [
      {
        url: new URL(c.req.url).origin,
        description: 'Current environment',
      },
    ],
    tags: [
      {
        name: 'System',
        description: 'Operational endpoints for health and readiness checks.',
      },
      {
        name: 'CLI Auth',
        description: 'Browser-to-CLI authentication flows that mint bearer tokens for the CLI.',
      },
      {
        name: 'Uploads',
        description: 'Draft upload, asset transfer, and revision finalization endpoints used during sync.',
      },
      {
        name: 'Conversations',
        description: 'Authenticated read APIs for conversation summaries and render documents.',
      },
      {
        name: 'Artifacts',
        description: 'Artifact preview endpoints for the current conversation revision.',
      },
      {
        name: 'Profiles',
        description: 'Personal analytics and materialized session profile endpoints.',
      },
      {
        name: 'Repositories',
        description: 'Public aggregate analytics for repositories with shared sessions.',
      },
      {
        name: 'Viewer',
        description: 'Cookie-authenticated browser helper and smoke-test endpoints.',
      },
      {
        name: 'Pricing',
        description: 'Normalized model pricing catalog endpoints.',
      },
    ],
  }))

  app.get(
    '/docs',
    apiReference({
      spec: {
        url: '/openapi.json',
      },
      pageTitle: 'HowiCC API Reference',
      theme: 'purple',
      layout: 'modern',
      hideClientButton: false,
    }),
  )

  return app
}

export type App = ReturnType<typeof createApp>
