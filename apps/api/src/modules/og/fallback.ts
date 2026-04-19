/**
 * 1x1 transparent PNG served as a last-resort fallback when the renderer
 * fails AND no previous cached image is available. Social crawlers accept
 * this as a valid OG image response (non-500) while the real card renders
 * on the next request.
 *
 * We deliberately keep the fallback tiny so it never eats into the worker
 * bundle budget. A prettier, branded fallback can be added later by
 * uploading a static PNG to R2 and loading it via a bootstrap command.
 */
const TRANSPARENT_PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const decodeBase64 = (text: string): Uint8Array => {
  const binary =
    typeof atob === 'function'
      ? atob(text)
      : Buffer.from(text, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

let cachedFallback: Uint8Array | null = null

export const getFallbackOgBytes = (): Uint8Array => {
  if (cachedFallback) return cachedFallback
  cachedFallback = decodeBase64(TRANSPARENT_PIXEL_BASE64)
  return cachedFallback
}
