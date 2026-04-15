import { inspectResolvedText, resolvePrivacyOptions } from './engine'
import type {
  PrivacyInspection,
  PrivacyOptions,
  PrivacyRedactionResult,
  PrivacySegment,
  PrivacySummary,
} from './types'

const mergeSummaries = (left: PrivacySummary, right: PrivacySummary): PrivacySummary => ({
  warnings: left.warnings + right.warnings,
  reviews: left.reviews + right.reviews,
  blocks: left.blocks + right.blocks,
})

/**
 * Report privacy findings across a group of text segments.
 *
 * This is the conversation-shaped API. The package still stays provider-neutral:
 * the caller decides how messages, tool inputs, or artifacts map into segments.
 */
export const inspectSegments = <TSegment extends PrivacySegment>(
  segments: readonly TSegment[],
  options?: PrivacyOptions,
): PrivacyInspection => {
  const resolvedOptions = resolvePrivacyOptions(options)

  return segments.reduce<PrivacyInspection>(
    (inspection, segment) => {
      const nextResult = inspectResolvedText(segment.text, resolvedOptions, segment)

      return {
        findings: [...inspection.findings, ...nextResult.findings],
        summary: mergeSummaries(inspection.summary, nextResult.summary),
      }
    },
    {
      findings: [],
      summary: { warnings: 0, reviews: 0, blocks: 0 },
    },
  )
}

/**
 * Redact a group of text segments and preserve their non-text metadata.
 *
 * Each segment is copied before mutation so callers can safely reuse their original
 * message or artifact objects.
 */
export const redactSegments = <TSegment extends PrivacySegment>(
  segments: readonly TSegment[],
  options?: PrivacyOptions,
): PrivacyRedactionResult<TSegment[]> => {
  const resolvedOptions = resolvePrivacyOptions(options)

  return segments.reduce<PrivacyRedactionResult<TSegment[]>>(
    (result, segment) => {
      const nextResult = inspectResolvedText(segment.text, resolvedOptions, segment)

      return {
        value: [...result.value, { ...segment, text: nextResult.value }],
        changed: result.changed || nextResult.changed,
        findings: [...result.findings, ...nextResult.findings],
        summary: mergeSummaries(result.summary, nextResult.summary),
      }
    },
    {
      value: [],
      changed: false,
      findings: [],
      summary: { warnings: 0, reviews: 0, blocks: 0 },
    },
  )
}
