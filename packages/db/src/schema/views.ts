import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Per-view rows for conversations. Used to increment visible view counts on
 * public `/s/:slug` shares and to debounce rapid same-day hits from the same
 * viewer. Owners never increment their own pages.
 */
export const conversationViews = sqliteTable(
  'conversation_views',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    viewerKey: text('viewer_key').notNull(),
    viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).notNull(),
    day: text('day').notNull(),
  },
  table => ({
    conversationIdIdx: index('conversation_views_conversation_idx').on(
      table.conversationId,
    ),
    convKeyDayIdx: index('conversation_views_conv_key_day_idx').on(
      table.conversationId,
      table.viewerKey,
      table.day,
    ),
  }),
)

/**
 * Per-view rows for public profile pages. Drives the profileViewCount shown
 * on the owner's dashboard.
 */
export const profileViews = sqliteTable(
  'profile_views',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    viewerKey: text('viewer_key').notNull(),
    viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).notNull(),
    day: text('day').notNull(),
  },
  table => ({
    userIdIdx: index('profile_views_user_idx').on(table.userId),
    userKeyDayIdx: index('profile_views_user_key_day_idx').on(
      table.userId,
      table.viewerKey,
      table.day,
    ),
  }),
)
