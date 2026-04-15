import { defineMiddleware } from 'astro:middleware'
import { getRequestSession } from './lib/auth/server'
import type { WebLocals } from './lib/auth/types'

export const onRequest = defineMiddleware(async (context, next) => {
  const apiUrl = import.meta.env.API_SERVER_URL ?? import.meta.env.PUBLIC_API_URL
  const auth = await getRequestSession({
    request: context.request,
    apiUrl,
  })

  const locals = context.locals as WebLocals
  locals.auth = auth
  locals.authApiUrl = apiUrl
  locals.runtimeApiUrl = apiUrl

  return next()
})
