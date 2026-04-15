import * as z from 'zod'
import type { Preset } from 'envin/types'

export const dbServerSchema = {
  DB_PROVIDER: z.enum(['d1', 'postgres']).default('d1'),
  DATABASE_URL: z.string().optional(),
} as const

export const dbPreset = {
  id: 'db',
  server: dbServerSchema,
} as const satisfies Preset
