import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { uploadSessionStatusValues } from './enums'
import { users } from './users'

export const uploadSessions = sqliteTable('upload_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceRevisionHash: text('source_revision_hash').notNull(),
  status: text('status', { enum: uploadSessionStatusValues }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  finalizedAt: integer('finalized_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const uploadSessionAssets = sqliteTable(
  'upload_session_assets',
  {
    id: text('id').primaryKey(),
    uploadSessionId: text('upload_session_id')
      .notNull()
      .references(() => uploadSessions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    bytes: integer('bytes').notNull(),
    contentType: text('content_type'),
    uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    uploadSessionKindIndex: uniqueIndex('upload_session_assets_upload_kind_idx').on(
      table.uploadSessionId,
      table.kind,
    ),
  }),
)
