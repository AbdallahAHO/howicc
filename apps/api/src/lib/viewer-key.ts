/**
 * Hashed viewer identifier used to debounce view-counter endpoints without
 * storing raw IPs. Falls back to a per-day salt so the same visitor on the
 * same day yields the same key but different days produce different keys —
 * keeps per-day dedup cheap without tracking identity across days.
 */
import type { ApiAuthRuntimeEnv } from './auth'

const textEncoder = new TextEncoder()

const hashString = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input))
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex.slice(0, 32)
}

const extractClientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'anonymous'
}

export const deriveViewerKey = async (
  request: Request,
  runtimeEnv: Partial<ApiAuthRuntimeEnv>,
): Promise<string> => {
  const ip = extractClientIp(request)
  const userAgent = request.headers.get('user-agent') ?? ''
  const salt = runtimeEnv.BETTER_AUTH_SECRET ?? 'howicc-views'
  return hashString(`${salt}:${ip}:${userAgent}`)
}
