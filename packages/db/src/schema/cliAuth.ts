import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './users'

export const cliAuthGrants = sqliteTable(
  'cli_auth_grants',
  {
    id: text('id').primaryKey(),
    codeHash: text('code_hash').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    callbackUrl: text('callback_url').notNull(),
    state: text('state').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    codeHashIndex: uniqueIndex('cli_auth_grants_code_hash_idx').on(table.codeHash),
  }),
)
