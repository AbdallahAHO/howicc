export type PrivacySeverity = 'warning' | 'review' | 'block'

export type PrivacyCategory =
  | 'secret'
  | 'credential'
  | 'pii'
  | 'filesystem'
  | 'network'

export type PrivacySegment = {
  id: string
  text: string
  kind?: string
  role?: string
  path?: string
}

export type PrivacyRuleSource = {
  name: string
  url: string
}

export type PrivacyRuleMatch = {
  start: number
  end: number
  text: string
  replacement?: string
  severity?: PrivacySeverity
}

export type PrivacyFinding = {
  ruleId: string
  category: PrivacyCategory
  severity: PrivacySeverity
  segmentId?: string
  segmentKind?: string
  role?: string
  path?: string
  start: number
  end: number
  matchedTextLength: number
  replacement: string
  maskedPreview: string
}

export type PrivacySummary = {
  warnings: number
  reviews: number
  blocks: number
}

export type PrivacyInspection = {
  findings: PrivacyFinding[]
  summary: PrivacySummary
}

export type PrivacyRedactionResult<TValue> = PrivacyInspection & {
  value: TValue
  changed: boolean
}

export type PrivacyRuleContext = {
  text: string
  segment?: PrivacySegment
  options: ResolvedPrivacyOptions
}

export type PrivacyRule = {
  id: string
  category: PrivacyCategory
  defaultSeverity: PrivacySeverity
  description: string
  keywords?: string[]
  priority?: number
  sources?: PrivacyRuleSource[]
  detect(context: PrivacyRuleContext): PrivacyRuleMatch[]
  replace?(match: PrivacyRuleMatch, context: PrivacyRuleContext): string
}

export type PrivacyOptions = {
  preset?: 'public-share'
  rules?: PrivacyRule[]
  allowPatterns?: Array<string | RegExp>
  homeDirectories?: string[]
  privateHostSuffixes?: string[]
  secretValueStopwords?: string[]
}

export type ResolvedPrivacyOptions = {
  preset: 'public-share'
  rules: PrivacyRule[]
  allowPatterns: RegExp[]
  homeDirectories: string[]
  privateHostSuffixes: string[]
  secretValueStopwords: string[]
}
