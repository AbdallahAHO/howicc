import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import {
  apiTokens,
  conversationAssets,
  conversations,
  conversationRevisions,
  sessionDigests,
  userProfiles,
  users,
} from './schema'

export type UserRecord = InferSelectModel<typeof users>
export type NewUserRecord = InferInsertModel<typeof users>

export type ApiTokenRecord = InferSelectModel<typeof apiTokens>
export type NewApiTokenRecord = InferInsertModel<typeof apiTokens>

export type ConversationRecord = InferSelectModel<typeof conversations>
export type NewConversationRecord = InferInsertModel<typeof conversations>

export type ConversationRevisionRecord =
  InferSelectModel<typeof conversationRevisions>
export type NewConversationRevisionRecord =
  InferInsertModel<typeof conversationRevisions>

export type ConversationAssetRecord = InferSelectModel<typeof conversationAssets>
export type NewConversationAssetRecord =
  InferInsertModel<typeof conversationAssets>

export type SessionDigestRecord = InferSelectModel<typeof sessionDigests>
export type NewSessionDigestRecord = InferInsertModel<typeof sessionDigests>

export type UserProfileRecord = InferSelectModel<typeof userProfiles>
export type NewUserProfileRecord = InferInsertModel<typeof userProfiles>
