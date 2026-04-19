import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    githubUserId: text('github_user_id'),
    username: text('username').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .default(false)
      .notNull(),
    name: text('name').notNull(),
    image: text('image'),
    bio: text('bio'),
    websiteUrl: text('website_url'),
    publicProfileEnabled: integer('public_profile_enabled', { mode: 'boolean' })
      .default(false)
      .notNull(),
    publicProfileSettings: text('public_profile_settings', { mode: 'json' }),
    profileViewCount: integer('profile_view_count').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => ({
    emailIndex: uniqueIndex('users_email_idx').on(table.email),
    usernameIndex: uniqueIndex('users_username_idx').on(table.username),
  }),
)
