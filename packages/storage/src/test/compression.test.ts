import { describe, expect, it } from 'vitest'
import { gunzipBytes, gzipBytes, gzipJson, parseGzipJson } from '../compression'

describe('compression helpers', () => {
  it('round-trips gzipped JSON payloads', () => {
    const payload = {
      kind: 'render_document',
      blocks: [{ id: 'block_1', type: 'message', text: 'hello' }],
    }

    const compressed = gzipJson(payload)

    expect(parseGzipJson<typeof payload>(compressed)).toEqual(payload)
  })

  it('round-trips arbitrary gzipped bytes', () => {
    const original = new TextEncoder().encode('howicc source bundle archive')
    const compressed = gzipBytes(original)

    expect(gunzipBytes(compressed)).toEqual(original)
  })
})
