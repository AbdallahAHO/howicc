/**
 * Usernames that must never be claimable because they collide with routes,
 * would mislead users, or belong to GitHub's own reserved list.
 *
 * The list is lowercased and checked with exact equality. Source of truth for:
 *   - API signup / sync-username validation
 *   - Astro's /[username].astro fallback (rejects reserved slugs)
 *   - Tests that guard against regressions
 *
 * Keep synced with top-level routes in apps/web/src/pages/*.
 */
export const RESERVED_USERNAMES = [
  // Current top-level routes in the web app
  'home',
  'sessions',
  'insights',
  'settings',
  'login',
  'logout',
  'dashboard',
  'cli',
  'debug',
  'r',
  's',
  'index',

  // Reserved for future routes so we never have to migrate a user off a name
  'api',
  'og',
  'sitemap',
  'sitemap.xml',
  'robots',
  'robots.txt',
  'about',
  'pricing',
  'docs',
  'help',
  'support',
  'admin',
  'blog',
  'changelog',
  'status',
  'legal',
  'privacy',
  'terms',
  'tos',
  'contact',
  'security',

  // Infrastructure / well-known paths
  '_astro',
  'static',
  'public',
  'assets',
  'favicon.ico',
  '.well-known',

  // Product name and common impersonations
  'howicc',
  'howi',
  'www',
  'mail',
  'root',
  'me',
  'owner',
  'anonymous',
  'user',
  'users',
  'you',
] as const

export const RESERVED_USERNAME_SET = new Set<string>(RESERVED_USERNAMES)

/**
 * Returns true when the slug is safe to expose at `/:username`.
 *
 * Does not perform DB lookups; purely static validation. Callers must still
 * check DB uniqueness separately.
 */
export const isValidPublicUsername = (candidate: string): boolean => {
  if (!candidate) return false
  const lowered = candidate.toLowerCase()
  if (lowered !== candidate) return false
  if (lowered.length < 1 || lowered.length > 39) return false

  // GitHub login format: alphanumeric + hyphens, no leading/trailing/double hyphens.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lowered)) return false

  if (RESERVED_USERNAME_SET.has(lowered)) return false

  return true
}
