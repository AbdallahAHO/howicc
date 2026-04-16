import { defineMiddleware } from 'astro:middleware'
import { getRequestSession } from './lib/auth/server'
import type { WebLocals } from './lib/auth/types'
import { getRuntimeWebConfig } from './lib/runtime/web-config.server'

export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeConfig = getRuntimeWebConfig()
  const auth = await getRequestSession({
    request: context.request,
    apiUrl: runtimeConfig.apiServerUrl,
  })

  const locals = context.locals as WebLocals
  locals.auth = auth
  locals.authApiUrl = runtimeConfig.publicApiUrl
  locals.runtimeApiUrl = runtimeConfig.apiServerUrl
  locals.siteUrl = runtimeConfig.siteUrl
  locals.productName = runtimeConfig.productName

  return next()
})
