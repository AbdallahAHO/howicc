import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { RESERVED_USERNAME_SET, isValidPublicUsername } from '@howicc/contracts'
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

/**
 * GitHub is the source of truth for a user's username. This maps the
 * lowercased `login` from the GitHub profile onto our users.username column.
 *
 * Reserved slugs (e.g., GitHub handle happens to match a route name) fall
 * through to `{login}-user`. GitHub itself reserves most product names so
 * this is near-impossible in practice; the fallback exists for correctness.
 */
const deriveUsernameFromGithubLogin = (login: string): string => {
  const lowered = login.toLowerCase().trim()
  if (isValidPublicUsername(lowered)) return lowered

  if (RESERVED_USERNAME_SET.has(lowered)) return `${lowered}-user`

  const sanitized = lowered.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const candidate = sanitized.replace(/^-+|-+$/g, '')
  if (isValidPublicUsername(candidate)) return candidate

  return `${candidate || 'user'}-user`
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
    user: {
      additionalFields: {
        username: {
          type: 'string',
          required: true,
          input: false,
        },
      },
    },
    account: {
      accountLinking: {
        // Ensures username + other mapped fields re-sync from GitHub on
        // every sign-in so a GitHub handle rename propagates to HowiCC.
        updateUserInfoOnLink: true,
      },
    },
  }

  if (githubEnabled) {
    authOptions.socialProviders = {
      github: {
        clientId: options.githubClientId!,
        clientSecret: options.githubClientSecret!,
        mapProfileToUser: profile => {
          const githubLogin = typeof profile.login === 'string' ? profile.login : ''
          return {
            username: deriveUsernameFromGithubLogin(githubLogin),
          }
        },
      },
    }
  }

  return betterAuth(authOptions)
}

export type HowiccAuth = ReturnType<typeof createHowiccAuth>
export type Session = HowiccAuth['$Infer']['Session']
export type User = Session['user']

export { deriveUsernameFromGithubLogin }
