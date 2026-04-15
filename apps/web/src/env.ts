import { defineEnv } from 'envin'
import * as z from 'zod'

export const env = defineEnv({
  shared: {
    APP_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
  },
  clientPrefix: 'PUBLIC_',
  server: {
    API_SERVER_URL: z.string().url().default('http://localhost:8787'),
  },
  client: {
    PUBLIC_PRODUCT_NAME: z.string().default('HowiCC'),
    PUBLIC_SITE_URL: z.string().url().default('http://localhost:4321'),
    PUBLIC_API_URL: z.string().url().default('http://localhost:8787'),
  },
  env: import.meta.env,
  isServer: import.meta.env.SSR,
})

export type WebEnv = typeof env
