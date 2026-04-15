import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import * as schema from '@howicc/db/schema'
import { betterAuth, type BetterAuthOptions } from 'better-auth'

export type CreateHowiccAuthOptions = {
  db: Parameters<typeof drizzleAdapter>[0]
  baseURL: string
  secret: string
  webOrigin: string
  githubClientId?: string
  githubClientSecret?: string
}

export const createHowiccAuth = (options: CreateHowiccAuthOptions) => {
  const githubEnabled =
    Boolean(options.githubClientId) && Boolean(options.githubClientSecret)

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
      crossSubDomainCookies: {
        enabled: true,
      },
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
