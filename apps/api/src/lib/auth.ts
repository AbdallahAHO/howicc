import { createHowiccAuth } from '@howicc/auth/server'
import { createD1DatabaseAdapter } from '@howicc/db/adapters/d1'

export type ApiAuthRuntimeEnv = {
  APP_ENV?: 'development' | 'staging' | 'production' | 'test'
  WEB_APP_URL: string
  API_BASE_URL: string
  BETTER_AUTH_SECRET?: string
  COOKIE_DOMAIN?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  DB: unknown
}

const requireConfiguredSecret = (
  secretName: string,
  value: string | undefined,
  appEnv?: ApiAuthRuntimeEnv['APP_ENV'],
) => {
  if (typeof value === 'string' && value.length >= 32) {
    return value
  }

  const environment = appEnv ?? 'unknown'
  throw new Error(
    `${secretName} must be configured for API auth in ${environment}.`,
  )
}

export const createApiAuthContext = (runtimeEnv: ApiAuthRuntimeEnv) => {
  const db = createD1DatabaseAdapter(runtimeEnv.DB as never).db
  const secret = requireConfiguredSecret(
    'BETTER_AUTH_SECRET',
    runtimeEnv.BETTER_AUTH_SECRET,
    runtimeEnv.APP_ENV,
  )

  return {
    db,
    auth: createHowiccAuth({
      db,
      baseURL: runtimeEnv.API_BASE_URL,
      secret,
      webOrigin: runtimeEnv.WEB_APP_URL,
      cookieDomain: runtimeEnv.COOKIE_DOMAIN,
      githubClientId: runtimeEnv.GITHUB_CLIENT_ID,
      githubClientSecret: runtimeEnv.GITHUB_CLIENT_SECRET,
    }),
  }
}

export const createApiAuth = (runtimeEnv: ApiAuthRuntimeEnv) =>
  createApiAuthContext(runtimeEnv).auth
