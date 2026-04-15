import { describe, expect, it } from 'vitest'
import { inspectSegments, redactSegments } from '../redactSegments'

describe('redactSegments', () => {
  it('redacts conversation-style segments without mutating the input array', () => {
    const segments = [
      {
        id: 'user:1',
        kind: 'message',
        role: 'user',
        text: 'See /Users/abdallah/Developer/personal/howicc and curl http://localhost:3000',
      },
      {
        id: 'assistant:1',
        kind: 'message',
        role: 'assistant',
        text: 'Email abdallah@company.com and set SERVICE_TOKEN=plain-text-secret-value',
      },
    ] as const

    const result = redactSegments(segments)

    expect(result.value[0]?.text).toContain(
      '/Users/<redacted>/Developer/personal/howicc',
    )
    expect(result.value[0]?.text).toContain('http://<local-host>:3000')
    expect(result.value[1]?.text).toContain('<redacted-email>')
    expect(result.value[1]?.text).toContain('SERVICE_TOKEN=<redacted-secret>')
    expect(result.findings.map(finding => finding.segmentId)).toEqual([
      'user:1',
      'user:1',
      'assistant:1',
      'assistant:1',
    ])
    expect(segments[0].text).toContain('/Users/abdallah/')
    expect(segments[1].text).toContain('abdallah@company.com')
  })

  it('aggregates inspection results across segments', () => {
    const inspection = inspectSegments([
      {
        id: 'tool:1',
        kind: 'tool_output',
        text: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
      {
        id: 'artifact:1',
        kind: 'artifact',
        text: 'Call me at +49 151 2345 6789',
      },
    ])

    expect(inspection.summary.blocks).toBe(1)
    expect(inspection.summary.reviews).toBe(1)
    expect(inspection.findings.map(finding => finding.segmentId)).toEqual([
      'tool:1',
      'artifact:1',
    ])
  })
})
