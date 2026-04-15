import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  apiTokens,
  conversationAssets,
  conversations,
  conversationRevisions,
  users,
} from './schema'

export const userSelectSchema: z.ZodTypeAny = createSelectSchema(users)
export const userInsertSchema: z.ZodTypeAny = createInsertSchema(users)

export const apiTokenSelectSchema: z.ZodTypeAny = createSelectSchema(apiTokens)
export const apiTokenInsertSchema: z.ZodTypeAny = createInsertSchema(apiTokens)

export const conversationSelectSchema: z.ZodTypeAny =
  createSelectSchema(conversations)
export const conversationInsertSchema: z.ZodTypeAny =
  createInsertSchema(conversations)

export const conversationRevisionSelectSchema: z.ZodTypeAny =
  createSelectSchema(conversationRevisions)
export const conversationRevisionInsertSchema: z.ZodTypeAny =
  createInsertSchema(conversationRevisions)

export const conversationAssetSelectSchema: z.ZodTypeAny =
  createSelectSchema(conversationAssets)
export const conversationAssetInsertSchema: z.ZodTypeAny =
  createInsertSchema(conversationAssets)
