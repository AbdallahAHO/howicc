import { describe, expect, it } from 'vitest'
import { inspectSegments, redactSegments } from '../redactSegments'
import {
  buildLargeWorkbenchSegments,
  buildWorkbenchSegments,
  joinSegmentTexts,
} from './fixtures/workbench'

const countFindingsByRule = (ruleIds: string[]) =>
  ruleIds.reduce<Record<string, number>>((counts, ruleId) => {
    counts[ruleId] = (counts[ruleId] ?? 0) + 1
    return counts
  }, {})

describe('workbench corpus coverage', () => {
  it('redacts real workbench transcript segments from the local fixture corpus', () => {
    const segments = buildWorkbenchSegments('v6')
    const originalText = joinSegmentTexts(segments)

    expect(originalText).toContain('/Users/abdallah/')
    expect(originalText).toContain('http://localhost')

    const result = redactSegments(segments)
    const redactedText = joinSegmentTexts(result.value)
    const findingsByRule = countFindingsByRule(
      result.findings.map(finding => finding.ruleId),
    )

    expect(redactedText).not.toContain('/Users/abdallah/')
    expect(redactedText).toContain('/Users/<redacted>/')
    expect(redactedText).toContain('http://<local-host>')
    expect(findingsByRule['home-directory-path']).toBeGreaterThan(100)
    expect(findingsByRule['private-url']).toBeGreaterThan(0)
    expect(findingsByRule['email-address']).toBeGreaterThan(0)
    expect(result.summary.reviews).toBeGreaterThan(100)
    expect(segments[0]?.text).toBeDefined()
  })

  it('finds stable privacy signals across multiple workbench versions', () => {
    const v3Inspection = inspectSegments(buildWorkbenchSegments('v3'))
    const v6Inspection = inspectSegments(buildWorkbenchSegments('v6'))

    for (const inspection of [v3Inspection, v6Inspection]) {
      const findingsByRule = countFindingsByRule(
        inspection.findings.map(finding => finding.ruleId),
      )

      expect(inspection.findings.length).toBeGreaterThan(0)
      expect(findingsByRule['home-directory-path']).toBeGreaterThan(0)
      expect(inspection.summary.reviews).toBeGreaterThan(0)
    }
  })

  it(
    'processes a repeated real transcript corpus within a practical budget',
    { timeout: 15_000 },
    () => {
      const largeSegments = buildLargeWorkbenchSegments({
        version: 'v6',
        repeat: 4,
        limit: 1_500,
      })

      const startedAt = performance.now()
      const result = redactSegments(largeSegments)
      const durationMs = performance.now() - startedAt

      expect(largeSegments.length).toBeGreaterThan(4_000)
      expect(result.findings.length).toBeGreaterThan(400)
      expect(durationMs).toBeLessThan(5_000)
    },
  )
})
