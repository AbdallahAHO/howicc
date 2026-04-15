import * as z from 'zod'
import type { Preset } from 'envin/types'

export const authServerSchema = {
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
} as const

export const authPreset = {
  id: 'auth',
  server: authServerSchema,
} as const satisfies Preset
