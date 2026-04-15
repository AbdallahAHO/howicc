export const conversationVisibilityValues = ['private', 'unlisted', 'public'] as const
export const conversationStatusValues = ['draft', 'ready', 'published', 'archived'] as const
export const conversationAssetKindValues = [
  'source_bundle',
  'canonical_json',
  'render_json',
  'artifact',
] as const

export const uploadSessionStatusValues = ['draft', 'finalized', 'expired'] as const

export type ConversationVisibility =
  (typeof conversationVisibilityValues)[number]
export type ConversationStatus = (typeof conversationStatusValues)[number]
export type ConversationAssetKind =
  (typeof conversationAssetKindValues)[number]
export type UploadSessionStatus = (typeof uploadSessionStatusValues)[number]
