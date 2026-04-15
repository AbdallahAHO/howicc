import * as z from 'zod'

export const cliEnvSchema = z.object({
  HOWICC_API_URL: z.string().url().default('https://api.howi.cc'),
  HOWICC_WEB_URL: z.string().url().default('https://howi.cc'),
})

export const cliEnv = cliEnvSchema.parse({
  HOWICC_API_URL: process.env.HOWICC_API_URL,
  HOWICC_WEB_URL: process.env.HOWICC_WEB_URL,
})
