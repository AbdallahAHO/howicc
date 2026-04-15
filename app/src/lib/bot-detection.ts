/**
 * Bot Detection Utility
 * Simple best-effort bot detection for view counting
 */

const BOT_USER_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'curl',
  'wget',
  'python-requests',
  'go-http-client',
  'java',
  'node-fetch',
  'axios',
  'postman',
  'insomnia',
  'httpie',
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'facebot',
  'ia_archiver',
  'archive.org_bot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'megaindex',
  'blexbot',
  'petalbot',
  'applebot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'slackbot',
  'redditbot',
  'pinterestbot',
  'tumblr',
  'bitlybot',
  'flipboard',
  'quora',
  'outbrain',
  'pocket',
  'instapaper',
  'feedly',
  'feedburner',
  'feedvalidator',
  'rss',
  'atom',
  'syndication',
];

/**
 * Check if a request is likely from a bot
 */
export function isBotRequest(
  userAgent: string | null,
  method: string,
  referer: string | null
): boolean {
  // Ignore HEAD requests (often used by bots)
  if (method === 'HEAD') {
    return true;
  }

  // Check for missing referer with no user agent (likely bot)
  if (!referer && !userAgent) {
    return true;
  }

  // Check user agent against known bot patterns
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
  }

  return false;
}

/**
 * Check if request has DNT (Do Not Track) header
 */
export function hasDNT(request: Request): boolean {
  return request.headers.get('DNT') === '1' ||
         request.headers.get('Do-Not-Track') === '1';
}
