import { createRoute, z } from '@hono/zod-openapi'
import { errorResponseSchema } from './shared'

const isoDateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

export const sitemapEntrySchema = z
  .object({
    type: z.enum(['public_profile', 'shared_session', 'public_repo']),
    path: z.string().openapi({
      example: '/abdallahali',
      description: 'Site-relative path. Prepend the canonical origin to build an absolute URL.',
    }),
    lastmod: isoDateTimeSchema.optional(),
  })
  .openapi('SitemapEntry')

export const sitemapUrlsResponseSchema = z
  .object({
    success: z.literal(true),
    entries: z.array(sitemapEntrySchema),
  })
  .openapi('SitemapUrlsResponse')

export const getSitemapUrlsRoute = createRoute({
  method: 'get',
  path: '/sitemap/urls',
  tags: ['System'],
  summary: 'Return the set of crawlable public URLs for the sitemap',
  description:
    "Returns every currently-crawlable public URL owned by HowiCC: opted-in public profiles, public shared conversations, and repositories that have at least one public session. Used by the web `sitemap.xml` route to render the XML without direct DB access.",
  operationId: 'getSitemapUrls',
  responses: {
    200: {
      description: 'Flat list of crawlable entries',
      content: {
        'application/json': {
          schema: sitemapUrlsResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

export type SitemapEntry = z.infer<typeof sitemapEntrySchema>
export type SitemapUrlsResponse = z.infer<typeof sitemapUrlsResponseSchema>
