import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const sessionDigests = sqliteTable(
  'session_digests',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    revisionId: text('revision_id').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    provider: text('provider').notNull(),
    projectKey: text('project_key').notNull(),
    repository: text('repository'),
    digestJson: text('digest_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    convRevIndex: uniqueIndex('session_digests_conv_rev_idx').on(
      table.conversationId,
      table.revisionId,
    ),
    ownerIndex: index('session_digests_owner_idx').on(table.ownerUserId),
    repositoryIndex: index('session_digests_repo_idx').on(table.repository),
  }),
)

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  profileJson: text('profile_json').notNull(),
  digestCount: integer('digest_count').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})
