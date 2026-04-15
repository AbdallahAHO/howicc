import { defineEnv } from 'envin'
import type { Preset } from 'envin/types'
import * as z from 'zod'
import { authPreset } from '@howicc/auth/keys'
import { dbPreset } from '@howicc/db/keys'
import { storagePreset } from '@howicc/storage/keys'

type RuntimeEnv = Record<string, string | undefined>

const shouldSkipValidation = (runtimeEnv: RuntimeEnv) => {
  const skip = runtimeEnv.SKIP_ENV_VALIDATION?.toLowerCase()
  return skip === '1' || skip === 'true'
}

export const jobsPreset = {
  id: 'jobs',
  server: {
    APP_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
    PRODUCT_NAME: z.string().default('HowiCC'),
    JOBS_WORKER_NAME: z.string().default('howicc-jobs'),
    API_BASE_URL: z.url().default('http://localhost:8787'),
  },
  extends: [authPreset, dbPreset, storagePreset],
} as const satisfies Preset

export const createJobsEnv = (runtimeEnv: RuntimeEnv) =>
  defineEnv({
    ...jobsPreset,
    env: runtimeEnv,
    skip: shouldSkipValidation(runtimeEnv),
  })

const defaultRuntimeEnv: RuntimeEnv =
  typeof process !== 'undefined' ? (process.env as RuntimeEnv) : {}

export const env = createJobsEnv(defaultRuntimeEnv)

export type JobsEnv = typeof env
