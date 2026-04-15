import * as z from 'zod'
import type { Preset } from 'envin/types'

export const storageServerSchema = {
  STORAGE_PROVIDER: z.enum(['r2', 's3-compatible']).default('r2'),
  STORAGE_BUCKET_NAME: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
} as const

export const storagePreset = {
  id: 'storage',
  server: storageServerSchema,
} as const satisfies Preset
