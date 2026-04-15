import type { ParsedRawEntry } from '../jsonl'
import { asArray, getString, isRecord } from '../utils'
import { normalizeClaudeCommandText } from './commandText'

const imageOnlyLinePattern =
  /^(?:\[image(?::[^\]]+| #[^\]]+)?\]|\[\d+ images? attached\])$/i

const imagePrefixPattern = /^\[image(?::[^\]]+| #[^\]]+)?\]\s*/i
const skipPromptPreviewPattern =
  /^(?:\s*<[a-z][\w-]*[\s>]|\[Request interrupted by user[^\]]*\])/i

const normalizePromptPreview = (value: string): string | undefined => {
  const normalized = normalizeClaudeCommandText(value)
  if (normalized.isLocalCommandCaveat) {
    return undefined
  }
  if (!normalized.commandInvocation && skipPromptPreviewPattern.test(value)) {
    return undefined
  }

  const lines = (normalized.text ?? value)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (imageOnlyLinePattern.test(line)) {
      continue
    }

    const cleaned = line.replace(imagePrefixPattern, '').trim()

    if (cleaned && !imageOnlyLinePattern.test(cleaned)) {
      return cleaned.slice(0, 140)
    }
  }

  return undefined
}

export const isLowSignalTitle = (value: string | undefined): boolean => {
  if (!value) return true

  const trimmed = value.trim()

  if (!trimmed) return true
  if (/^\/[a-z0-9:_-]+(?:\s+.+)?$/i.test(trimmed)) return false
  if (/^!\s+\S.+$/i.test(trimmed)) return false
  if (/^\((?:bash|command) completed with no output\)$/i.test(trimmed)) return true
  if (trimmed.length < 8) return true
  if (!/[a-z0-9]{4,}/i.test(trimmed)) return true

  return false
}

export const pickPromptTitleCandidate = (
  candidates: Array<string | undefined>,
): string | undefined => {
  const normalized = candidates
    .map(candidate => (candidate ? normalizePromptPreview(candidate) : undefined))
    .filter((candidate): candidate is string => Boolean(candidate))

  return normalized.find(candidate => !isLowSignalTitle(candidate)) ?? normalized[0]
}

export const extractUserPromptPreview = (
  raw: Record<string, unknown>,
): string | undefined => {
  if (raw.type !== 'user') return undefined

  const message = isRecord(raw.message) ? raw.message : undefined
  const content = message?.content

  if (typeof content === 'string') {
    return normalizePromptPreview(content)
  }

  const textBlocks = asArray(content)
    .map(block => {
      if (typeof block === 'string') {
        return normalizePromptPreview(block)
      }

      if (!isRecord(block)) return undefined
      if (getString(block.type) !== 'text') return undefined

      return normalizePromptPreview(getString(block.text) ?? '')
    })
    .filter((value): value is string => Boolean(value))

  return textBlocks[0]
}

export const extractSelectedPromptTitle = (
  entries: ParsedRawEntry[],
): string | undefined =>
  pickPromptTitleCandidate(entries.map(entry => extractUserPromptPreview(entry.raw)))
