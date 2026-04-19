import { getRuntimeStorage } from '../../lib/runtime-resources'
import type { ApiRuntime } from '../../runtime'

/**
 * Builds a stable R2 cache key for a profile OG image. The key captures
 * everything that affects rendering so any profile update produces a new
 * key — no manual invalidation needed.
 */
export const buildProfileCardCacheKey = async (input: {
  username: string
  displayName: string
  avatarUrl?: string
  sessionCount: number
  totalDurationMs: number
  currentStreak: number
}): Promise<string> => {
  const payload = [
    input.username,
    input.displayName,
    input.avatarUrl ?? '',
    input.sessionCount,
    input.totalDurationMs,
    input.currentStreak,
  ].join('|')

  const bytes = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  let hex = ''
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return `og/u/${input.username}/${hex.slice(0, 16)}.png`
}

export const readCachedProfileCard = async (
  runtime: ApiRuntime,
  key: string,
): Promise<Uint8Array | null> => {
  try {
    const storage = getRuntimeStorage(runtime)
    const object = await storage.getObject(key)
    if (!object?.body) return null
    if (object.body instanceof ArrayBuffer) {
      return new Uint8Array(object.body)
    }
    if (object.body instanceof Uint8Array) {
      return object.body
    }
    return null
  } catch {
    return null
  }
}

export const writeCachedProfileCard = async (
  runtime: ApiRuntime,
  key: string,
  bytes: Uint8Array,
): Promise<void> => {
  try {
    const storage = getRuntimeStorage(runtime)
    await storage.putObject({
      key,
      body: bytes,
      contentType: 'image/png',
      visibility: 'public',
    })
  } catch {
    // Cache failures must not bubble — the PNG still ships, just uncached.
  }
}
