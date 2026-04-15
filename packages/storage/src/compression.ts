import { gunzipSync, gzipSync } from 'node:zlib'

export const toUint8Array = (
  value: string | Uint8Array | ArrayBuffer,
): Uint8Array => {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value)
  }

  if (value instanceof Uint8Array) {
    return value
  }

  return new Uint8Array(value)
}

export const gzipBytes = (
  value: string | Uint8Array | ArrayBuffer,
): Uint8Array => new Uint8Array(gzipSync(toUint8Array(value)))

export const gunzipBytes = (
  value: Uint8Array | ArrayBuffer,
): Uint8Array => new Uint8Array(gunzipSync(toUint8Array(value)))

export const gzipJson = (value: unknown): Uint8Array =>
  gzipBytes(JSON.stringify(value))

export const parseGzipJson = <T>(value: Uint8Array | ArrayBuffer): T =>
  JSON.parse(new TextDecoder().decode(gunzipBytes(value))) as T
