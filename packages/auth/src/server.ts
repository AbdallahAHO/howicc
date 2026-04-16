import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import * as schema from '@howicc/db/schema'
import { betterAuth, type BetterAuthOptions } from 'better-auth'

export type CreateHowiccAuthOptions = {
  db: Parameters<typeof drizzleAdapter>[0]
  baseURL: string
  secret: string
  webOrigin: string
  cookieDomain?: string
  githubClientId?: string
  githubClientSecret?: string
}

const deriveCookieDomain = (input: {
  override?: string
  webOrigin: string
}): string | undefined => {
  if (input.override) return input.override
  try {
    const hostname = new URL(input.webOrigin).hostname
    if (hostname === 'localhost' || /^\d+(\.\d+){3}$/.test(hostname)) return undefined
    const parts = hostname.split('.')
    if (parts.length < 2) return undefined
    return parts.slice(-2).join('.')
  } catch {
    return undefined
  }
}

export const createHowiccAuth = (options: CreateHowiccAuthOptions) => {
  const githubEnabled =
    Boolean(options.githubClientId) && Boolean(options.githubClientSecret)

  const cookieDomain = deriveCookieDomain({
    override: options.cookieDomain,
    webOrigin: options.webOrigin,
  })

  const authOptions: BetterAuthOptions = {
    appName: 'HowiCC',
    baseURL: options.baseURL,
    basePath: '/auth',
    secret: options.secret,
    trustedOrigins: [options.webOrigin],
    database: drizzleAdapter(options.db, {
      provider: 'sqlite',
      schema,
      usePlural: true,
    }),
    advanced: {
      crossSubDomainCookies: cookieDomain
        ? { enabled: true, domain: cookieDomain }
        : { enabled: false },
      cookiePrefix: 'howicc',
    },
  }

  if (githubEnabled) {
    authOptions.socialProviders = {
      github: {
        clientId: options.githubClientId!,
        clientSecret: options.githubClientSecret!,
      },
    }
  }

  return betterAuth(authOptions)
}

export type HowiccAuth = ReturnType<typeof createHowiccAuth>
export type Session = HowiccAuth['$Infer']['Session']
export type User = Session['user']
