import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { conversationStatusValues, conversationVisibilityValues } from './enums'

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    visibility: text('visibility', { enum: conversationVisibilityValues }).notNull(),
    status: text('status', { enum: conversationStatusValues }).notNull(),
    sourceApp: text('source_app').notNull(),
    sourceSessionId: text('source_session_id').notNull(),
    sourceProjectKey: text('source_project_key').notNull(),
    currentRevisionId: text('current_revision_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    ownerSourceSessionIdx: uniqueIndex('conversations_owner_source_session_idx').on(
      table.ownerUserId,
      table.sourceApp,
      table.sourceSessionId,
    ),
    slugUniqueIdx: uniqueIndex('conversations_slug_unique_idx').on(table.slug),
  }),
)

export const conversationRevisions = sqliteTable(
  'conversation_revisions',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    sourceRevisionHash: text('source_revision_hash').notNull(),
    parserVersion: text('parser_version').notNull(),
    canonicalSchemaVersion: integer('canonical_schema_version').notNull(),
    renderSchemaVersion: integer('render_schema_version').notNull(),
    selectedLeafUuid: text('selected_leaf_uuid'),
    summary: text('summary'),
    safetyFlagsJson: text('safety_flags_json'),
    statsJson: text('stats_json'),
    searchText: text('search_text'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    conversationRevisionHashIdx: uniqueIndex('conversation_revisions_conversation_revision_hash_idx').on(
      table.conversationId,
      table.sourceRevisionHash,
    ),
  }),
)
