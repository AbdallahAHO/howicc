import type { APIContext, AstroGlobal } from 'astro'
import type { WebLocals } from './types'
import { getRuntimeWebConfig } from '../runtime/web-config.server'

type SessionResponse = {
  session: {
    id: string
    userId: string
    createdAt: string
    updatedAt: string
    expiresAt: string
    token: string
  } | null
  user: {
    id: string
    email: string
    name: string
    image?: string | null
    emailVerified?: boolean
    createdAt?: string
    updatedAt?: string
    isAnonymous?: boolean
  } | null
}

export const unauthenticatedState = {
  user: null,
  session: null,
  status: 'unauthenticated' as const,
}

export const getRequestSession = async (input: {
  request: Request
  apiUrl: string
}) => {
  const cookie = input.request.headers.get('cookie')

  if (!cookie) {
    return unauthenticatedState
  }

  const response = await fetch(new URL('/auth/get-session', input.apiUrl), {
    headers: {
      cookie,
      accept: 'application/json',
      'user-agent': input.request.headers.get('user-agent') ?? 'HowiCC Astro SSR',
    },
  })

  if (!response.ok) {
    return unauthenticatedState
  }

  const payload = (await response.json()) as SessionResponse | null

  if (!payload?.user || !payload.session) {
    return unauthenticatedState
  }

  return {
    user: payload.user,
    session: payload.session,
    status: payload.user.isAnonymous ? ('anonymous' as const) : ('authenticated' as const),
  }
}

export const requireUser = (astro: AstroGlobal | APIContext) => {
  const locals = astro.locals as WebLocals

  if (!locals.auth.user) {
    const returnTo = encodeURIComponent(astro.url.pathname)
    return astro.redirect(`/login?returnTo=${returnTo}`)
  }

  return locals.auth.user
}

export const createServerApiUrl = (astro: AstroGlobal | APIContext): string => {
  const locals = astro.locals as WebLocals

  if (typeof locals.runtimeApiUrl === 'string') return locals.runtimeApiUrl
  if (typeof locals.authApiUrl === 'string') return locals.authApiUrl

  return getRuntimeWebConfig().apiServerUrl
}
