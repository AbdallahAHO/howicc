/**
 * Hashed viewer identifier used to debounce view-counter endpoints without
 * storing raw IPs. Signed-in viewers dedupe by account id; anonymous viewers
 * fall back to an IP + user-agent fingerprint.
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
  viewerUserId?: string | null,
): Promise<string> => {
  const salt = runtimeEnv.BETTER_AUTH_SECRET ?? 'howicc-views'

  if (viewerUserId) {
    return hashString(`${salt}:user:${viewerUserId}`)
  }

  const ip = extractClientIp(request)
  const userAgent = request.headers.get('user-agent') ?? ''
  return hashString(`${salt}:anon:${ip}:${userAgent}`)
}
