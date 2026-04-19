import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const repoVisibilityValues = ['public', 'members', 'private'] as const

/**
 * Repository-level settings. A row exists only for repos an admin has touched
 * (created on first settings-page visit). Missing row ⇒ default `public`.
 */
export const repos = sqliteTable(
  'repos',
  {
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    visibility: text('visibility', { enum: repoVisibilityValues })
      .default('public')
      .notNull(),
    updatedByUserId: text('updated_by_user_id').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    ownerNameIndex: uniqueIndex('repos_owner_name_idx').on(table.owner, table.name),
  }),
)

/**
 * Conversations an admin has hidden from repo aggregation. Does not affect
 * conversation-level visibility — the owner's /s/:slug link still works.
 */
export const repoHiddenConversations = sqliteTable(
  'repo_hidden_conversations',
  {
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    conversationId: text('conversation_id').notNull(),
    hiddenByUserId: text('hidden_by_user_id').notNull(),
    hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    ownerNameConvIndex: uniqueIndex('repo_hidden_owner_name_conv_idx').on(
      table.owner,
      table.name,
      table.conversationId,
    ),
    convIndex: index('repo_hidden_conv_idx').on(table.conversationId),
  }),
)

/**
 * Admin acknowledgement that they reviewed the private-repo notice. Unlocks
 * visibility/hide/unhide endpoints for 30 days. Invalidated whenever any
 * admin changes visibility — the next edit forces a fresh review.
 */
export const repoAdminConsents = sqliteTable(
  'repo_admin_consents',
  {
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    userId: text('user_id').notNull(),
    consentedAt: integer('consented_at', { mode: 'timestamp_ms' }).notNull(),
    visibilityAtConsent: text('visibility_at_consent', {
      enum: repoVisibilityValues,
    }).notNull(),
  },
  table => ({
    ownerNameUserIndex: uniqueIndex('repo_admin_consents_owner_name_user_idx').on(
      table.owner,
      table.name,
      table.userId,
    ),
  }),
)

/**
 * Cached GitHub permission lookups so we don't hit the GitHub API on every
 * admin-page load. 1h TTL enforced by the service layer.
 */
export const repoPermissions = sqliteTable(
  'repo_permissions',
  {
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    userId: text('user_id').notNull(),
    permission: text('permission').notNull(),
    checkedAt: integer('checked_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    ownerNameUserIndex: uniqueIndex('repo_permissions_owner_name_user_idx').on(
      table.owner,
      table.name,
      table.userId,
    ),
  }),
)
