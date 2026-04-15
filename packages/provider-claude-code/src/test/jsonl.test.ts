import { describe, expect, it } from 'vitest'
import { JsonlParseError, parseJsonlText } from '../jsonl'

describe('parseJsonlText', () => {
  it('throws on malformed JSONL for full transcript reads', () => {
    expect(() =>
      parseJsonlText(
        [
          JSON.stringify({ type: 'user', uuid: 'u1' }),
          '{"type":"assistant"',
        ].join('\n'),
      ),
    ).toThrow(JsonlParseError)

    try {
      parseJsonlText(
        [
          JSON.stringify({ type: 'user', uuid: 'u1' }),
          '{"type":"assistant"',
        ].join('\n'),
      )
    } catch (error) {
      expect(error).toBeInstanceOf(JsonlParseError)
      expect((error as JsonlParseError).lineNumber).toBe(2)
    }
  })

  it('tolerates partial head or tail reads when partial parsing is enabled', () => {
    const entries = parseJsonlText(
      [
        JSON.stringify({ type: 'user', uuid: 'u1' }),
        '{"type":"assistant"',
      ].join('\n'),
      { allowPartial: true },
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]?.raw.type).toBe('user')
  })
})
