import { publicShareRules } from './rules/publicShare'
import { escapeForRegExp, truncatePreview } from './rules/shared'
import type {
  PrivacyFinding,
  PrivacyOptions,
  PrivacyRule,
  PrivacySegment,
  PrivacySummary,
  ResolvedPrivacyOptions,
} from './types'

type PrivacyCandidate = {
  rule: PrivacyRule
  start: number
  end: number
  text: string
  replacement: string
  severity: PrivacyFinding['severity']
}

const defaultSecretValueStopwords = [
  'your-api-key',
  'your_token',
  'your-token',
  'your_password',
  'your-password',
  'example',
  'placeholder',
  'changeme',
  'change-me',
]

const defaultPrivateHostSuffixes = ['local', 'internal', 'lan', 'home']

const compileAllowPatterns = (allowPatterns: Array<string | RegExp> = []) =>
  allowPatterns.map(pattern =>
    typeof pattern === 'string'
      ? new RegExp(escapeForRegExp(pattern), 'i')
      : new RegExp(pattern.source, pattern.flags),
  )

export const resolvePrivacyOptions = (
  options: PrivacyOptions = {},
): ResolvedPrivacyOptions => {
  return {
    preset: options.preset ?? 'public-share',
    rules: options.rules ?? publicShareRules,
    allowPatterns: compileAllowPatterns(options.allowPatterns),
    homeDirectories: options.homeDirectories ?? [],
    privateHostSuffixes: options.privateHostSuffixes ?? defaultPrivateHostSuffixes,
    secretValueStopwords:
      options.secretValueStopwords ?? defaultSecretValueStopwords,
  }
}

const overlaps = (left: Pick<PrivacyCandidate, 'start' | 'end'>, right: Pick<PrivacyCandidate, 'start' | 'end'>) =>
  left.start < right.end && right.start < left.end

const hasAllowedMatch = (
  candidate: Pick<PrivacyCandidate, 'text'>,
  resolvedOptions: ResolvedPrivacyOptions,
) =>
  resolvedOptions.allowPatterns.some(pattern => pattern.test(candidate.text))

const buildSummary = (findings: PrivacyFinding[]): PrivacySummary =>
  findings.reduce(
    (summary, finding) => {
      if (finding.severity === 'block') {
        summary.blocks += 1
      } else if (finding.severity === 'review') {
        summary.reviews += 1
      } else {
        summary.warnings += 1
      }

      return summary
    },
    { warnings: 0, reviews: 0, blocks: 0 },
  )

export const inspectResolvedText = (
  text: string,
  resolvedOptions: ResolvedPrivacyOptions,
  segment?: PrivacySegment,
) => {
  const candidates = resolvedOptions.rules
    .flatMap(rule =>
      rule.detect({ text, segment, options: resolvedOptions }).map(match => ({
        rule,
        start: match.start,
        end: match.end,
        text: match.text,
        replacement:
          match.replacement ??
          rule.replace?.(match, { text, segment, options: resolvedOptions }) ??
          '<redacted>',
        severity: match.severity ?? rule.defaultSeverity,
      })),
    )
    .filter(
      candidate =>
        candidate.end > candidate.start &&
        candidate.text.length > 0 &&
        !hasAllowedMatch(candidate, resolvedOptions),
    )
    .sort((left, right) => {
      if (left.start !== right.start) {
        return left.start - right.start
      }

      const priorityDelta =
        (right.rule.priority ?? 0) - (left.rule.priority ?? 0)
      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return (right.end - right.start) - (left.end - left.start)
    })

  const selectedCandidates: PrivacyCandidate[] = []

  for (const candidate of candidates) {
    if (selectedCandidates.some(existing => overlaps(candidate, existing))) {
      continue
    }

    selectedCandidates.push(candidate)
  }

  selectedCandidates.sort((left, right) => left.start - right.start)

  let redactedText = text
  for (const candidate of [...selectedCandidates].reverse()) {
    redactedText =
      redactedText.slice(0, candidate.start) +
      candidate.replacement +
      redactedText.slice(candidate.end)
  }

  const findings: PrivacyFinding[] = selectedCandidates.map(candidate => ({
    ruleId: candidate.rule.id,
    category: candidate.rule.category,
    severity: candidate.severity,
    segmentId: segment?.id,
    segmentKind: segment?.kind,
    role: segment?.role,
    path: segment?.path,
    start: candidate.start,
    end: candidate.end,
    matchedTextLength: candidate.text.length,
    replacement: candidate.replacement,
    maskedPreview: truncatePreview(candidate.replacement),
  }))

  return {
    value: redactedText,
    changed: redactedText !== text,
    findings,
    summary: buildSummary(findings),
  }
}
