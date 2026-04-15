import { defineEnv } from 'envin'
import type { Preset } from 'envin/types'
import * as z from 'zod'
import { authPreset } from '@howicc/auth/keys'
import { dbPreset } from '@howicc/db/keys'
import { storagePreset } from '@howicc/storage/keys'

type RuntimeEnv = Record<string, string | undefined>

const shouldSkipValidation = (runtimeEnv: RuntimeEnv) => {
  const skip = runtimeEnv.SKIP_ENV_VALIDATION?.toLowerCase()
  const lifecycleEvent = runtimeEnv.npm_lifecycle_event

  return (
    skip === '1' ||
    skip === 'true' ||
    lifecycleEvent === 'postinstall' ||
    lifecycleEvent === 'lint'
  )
}

export const apiPreset = {
  id: 'api',
  server: {
    APP_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
    PRODUCT_NAME: z.string().default('HowiCC'),
    API_BASE_URL: z.string().url().default('http://localhost:8787'),
    WEB_APP_URL: z.string().url().default('http://localhost:4321'),
    SHARE_TOKEN_SECRET: z.string().min(32).optional(),
  },
  extends: [authPreset, dbPreset, storagePreset],
} as const satisfies Preset

const requireProductionSecrets = <
  T extends {
    APP_ENV: 'development' | 'staging' | 'production' | 'test'
    BETTER_AUTH_SECRET?: string
    SHARE_TOKEN_SECRET?: string
  },
>(
  resolvedEnv: T,
) => {
  if (
    resolvedEnv.APP_ENV !== 'production' &&
    resolvedEnv.APP_ENV !== 'staging'
  ) {
    return resolvedEnv
  }

  const missing = [
    resolvedEnv.BETTER_AUTH_SECRET ? undefined : 'BETTER_AUTH_SECRET',
    resolvedEnv.SHARE_TOKEN_SECRET ? undefined : 'SHARE_TOKEN_SECRET',
  ].filter((value): value is string => Boolean(value))

  if (missing.length > 0) {
    throw new Error(
      `Missing required API secrets for ${resolvedEnv.APP_ENV}: ${missing.join(', ')}`,
    )
  }

  return resolvedEnv
}

export const createApiEnv = (runtimeEnv: RuntimeEnv) =>
  requireProductionSecrets(
    defineEnv({
      ...apiPreset,
      env: runtimeEnv,
      skip: shouldSkipValidation(runtimeEnv),
    }),
  )

const defaultRuntimeEnv: RuntimeEnv =
  typeof process !== 'undefined' ? (process.env as RuntimeEnv) : {}

export const env = createApiEnv(defaultRuntimeEnv)

export type ApiEnv = typeof env
