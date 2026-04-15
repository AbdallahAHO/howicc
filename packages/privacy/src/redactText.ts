import { inspectResolvedText, resolvePrivacyOptions } from './engine'
import type { PrivacyInspection, PrivacyOptions, PrivacyRedactionResult } from './types'

/**
 * Report privacy findings for a single text value without mutating the value.
 *
 * Use this when the caller wants a pre-flight report before deciding whether to
 * redact, block, or prompt for review.
 */
export const inspectText = (
  text: string,
  options?: PrivacyOptions,
): PrivacyInspection => {
  const result = inspectResolvedText(text, resolvePrivacyOptions(options))

  return {
    findings: result.findings,
    summary: result.summary,
  }
}

/**
 * Redact a single text value with deterministic public-share rules.
 *
 * The function is pure: it inspects the original text, resolves overlapping
 * findings once, and returns a redacted copy plus safe metadata about what was found.
 */
export const redactText = (
  text: string,
  options?: PrivacyOptions,
): PrivacyRedactionResult<string> =>
  inspectResolvedText(text, resolvePrivacyOptions(options))
