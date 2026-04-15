import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  table => ({
    tokenHashIndex: uniqueIndex('api_tokens_token_hash_idx').on(table.tokenHash),
  }),
)
