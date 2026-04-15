import type { ParsedRawEntry } from '../jsonl'
import { asArray, getBoolean, getString, isRecord, type JsonRecord } from '../utils'

export type RawContentBlock = JsonRecord

const unwrapRaw = (entry: ParsedRawEntry | JsonRecord): JsonRecord => {
  if ('raw' in entry && isRecord(entry.raw)) {
    return entry.raw
  }

  return entry
}

export const getEntryType = (entry: ParsedRawEntry | JsonRecord): string | undefined =>
  getString(unwrapRaw(entry).type)

export const getEntryUuid = (entry: ParsedRawEntry | JsonRecord): string | undefined =>
  getString(unwrapRaw(entry).uuid)

export const getEntryParentUuid = (
  entry: ParsedRawEntry | JsonRecord,
): string | undefined => getString(unwrapRaw(entry).parentUuid)

export const getEntryTimestamp = (
  entry: ParsedRawEntry | JsonRecord,
): string | undefined => getString(unwrapRaw(entry).timestamp)

export const isSidechainEntry = (entry: ParsedRawEntry | JsonRecord): boolean =>
  getBoolean(unwrapRaw(entry).isSidechain) ?? false

export const getMessage = (
  entry: ParsedRawEntry | JsonRecord,
): JsonRecord | undefined => {
  const raw = unwrapRaw(entry)
  return isRecord(raw.message) ? raw.message : undefined
}

export const getMessageModel = (
  entry: ParsedRawEntry | JsonRecord,
): string | undefined => getString(getMessage(entry)?.model)

export const getMessageUsage = (
  entry: ParsedRawEntry | JsonRecord,
): JsonRecord | undefined => {
  const usage = getMessage(entry)?.usage
  return isRecord(usage) ? usage : undefined
}

export const getPermissionMode = (
  entry: ParsedRawEntry | JsonRecord,
): string | undefined => getString(unwrapRaw(entry).permissionMode)

export const getSlug = (entry: ParsedRawEntry | JsonRecord): string | undefined =>
  getString(unwrapRaw(entry).slug)

export const getCwd = (entry: ParsedRawEntry | JsonRecord): string | undefined =>
  getString(unwrapRaw(entry).cwd)

export const getGitBranch = (
  entry: ParsedRawEntry | JsonRecord,
): string | undefined => getString(unwrapRaw(entry).gitBranch)

export const getTopLevelToolUseResult = (
  entry: ParsedRawEntry | JsonRecord,
): unknown => unwrapRaw(entry).toolUseResult

export const getMessageContent = (entry: ParsedRawEntry | JsonRecord): unknown =>
  getMessage(entry)?.content

export const getContentBlocks = (entry: ParsedRawEntry | JsonRecord): RawContentBlock[] =>
  asArray<unknown>(getMessageContent(entry)).filter(isRecord)

export const getTextBlocks = (entry: ParsedRawEntry | JsonRecord): RawContentBlock[] =>
  getContentBlocks(entry).filter(block => getString(block.type) === 'text')

export const getToolUseBlocks = (entry: ParsedRawEntry | JsonRecord): RawContentBlock[] =>
  getContentBlocks(entry).filter(block => getString(block.type) === 'tool_use')

export const getToolResultBlocks = (
  entry: ParsedRawEntry | JsonRecord,
): RawContentBlock[] =>
  getContentBlocks(entry).filter(block => getString(block.type) === 'tool_result')

export const isThinkingBlock = (block: JsonRecord): boolean =>
  getString(block.type) === 'thinking'

export const isRedactedThinkingBlock = (block: JsonRecord): boolean =>
  isThinkingBlock(block) && !getString(block.thinking)?.trim()

export const getThinkingText = (block: JsonRecord): string | undefined => {
  if (!isThinkingBlock(block)) return undefined
  const text = getString(block.thinking)
  return text?.trim() ? text : undefined
}

export const isImageBlock = (block: JsonRecord): boolean =>
  getString(block.type) === 'image'

export const extractTextContent = (content: unknown): string | undefined => {
  if (typeof content === 'string') {
    return content
  }

  const parts = asArray<unknown>(content)
    .map(part => {
      if (typeof part === 'string') return part
      if (!isRecord(part)) return undefined

      const partType = getString(part.type)

      if (partType === 'text') {
        return getString(part.text)
      }

      if (partType === 'tool_reference') {
        const toolName = getString(part.tool_name)
        return toolName ? `tool:${toolName}` : undefined
      }

      // Skip blocks that have dedicated handling elsewhere
      if (partType === 'thinking' || partType === 'image' || partType === 'tool_use' || partType === 'tool_result') {
        return undefined
      }

      return JSON.stringify(part)
    })
    .filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

export const countImageBlocks = (content: unknown): number =>
  asArray<unknown>(content)
    .filter(part => isRecord(part) && isImageBlock(part))
    .length

export const extractPersistedOutputPath = (text: string): string | undefined => {
  const match = text.match(/Full output saved to:\s+(.+?)(?:\n|$)/)
  return match?.[1]?.trim()
}
