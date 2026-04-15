import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { conversationAssetKindValues } from './enums'

export const conversationAssets = sqliteTable(
  'conversation_assets',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    kind: text('kind', { enum: conversationAssetKindValues }).notNull(),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    bytes: integer('bytes').notNull(),
    metaJson: text('meta_json'),
  },
  table => ({
    revisionKindIdx: uniqueIndex('conversation_assets_revision_kind_idx').on(
      table.revisionId,
      table.kind,
    ),
  }),
)
