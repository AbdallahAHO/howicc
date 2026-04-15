import type {
  CanonicalEvent,
  HookEvent,
  SystemNoticeEvent,
  ToolCallEvent,
  ToolResultEvent,
} from '@howicc/canonical'
import type { ParsedRawEntry } from '../jsonl'
import {
  countImageBlocks,
  extractPersistedOutputPath,
  extractTextContent,
  getContentBlocks,
  getEntryTimestamp,
  getEntryType,
  getEntryUuid,
  getMessage,
  getMessageContent,
  getThinkingText,
  getToolResultBlocks,
  getToolUseBlocks,
  getTopLevelToolUseResult,
  isRedactedThinkingBlock,
  isThinkingBlock,
} from './raw'
import { getString, isRecord } from '../utils'
import { normalizeClaudeCommandText } from './commandText'

export const buildEvents = (
  entries: ParsedRawEntry[],
  assetIdByAbsolutePath: Map<string, string>,
): CanonicalEvent[] => {
  const events: CanonicalEvent[] = []

  for (const entry of entries) {
    const type = getEntryType(entry)

    if (type === 'assistant') {
      events.push(...buildAssistantEvents(entry))
      continue
    }

    if (type === 'user') {
      events.push(...buildUserEvents(entry, assetIdByAbsolutePath))
      continue
    }

    if (type === 'system') {
      const systemEvent = buildSystemEvent(entry)
      if (systemEvent) events.push(systemEvent)
    }
  }

  return events
}

const buildAssistantEvents = (entry: ParsedRawEntry): CanonicalEvent[] => {
  const events: CanonicalEvent[] = []
  const message = getMessage(entry)
  const contentBlocks = getContentBlocks(entry)

  // Thinking blocks come in two forms:
  // 1. Redacted: thinking="" with only a signature hash — skip entirely
  // 2. Content: thinking="The user wants..." — real reasoning, show it
  const thinkingBlocks = contentBlocks.filter(isThinkingBlock)
  const nonThinkingBlocks = contentBlocks.filter(block => !isThinkingBlock(block))

  // Emit visible thinking content as an assistant message
  for (const block of thinkingBlocks) {
    const thinkingContent = getThinkingText(block)
    if (thinkingContent) {
      events.push({
        type: 'assistant_message',
        id: `${entry.index}:assistant:thinking`,
        uuid: getEntryUuid(entry),
        parentUuid: getString(entry.raw.parentUuid),
        timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
        text: thinkingContent,
        isMeta: true,
      })
    }
  }

  // If the only blocks were redacted thinking (empty text + signature), skip
  if (nonThinkingBlocks.length === 0 && thinkingBlocks.length > 0 && events.length === 0) {
    return events
  }

  const textBlocks = nonThinkingBlocks.filter(
    block => getString(block.type) === 'text',
  )
  const assistantText = extractTextContent(textBlocks)

  if (assistantText) {
    events.push({
      type: 'assistant_message',
      id: `${entry.index}:assistant:text`,
      uuid: getEntryUuid(entry),
      parentUuid: getString(entry.raw.parentUuid),
      timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
      text: assistantText,
      isMeta: false,
      isApiErrorMessage: false,
    })
  }

  const toolUseBlocks = getToolUseBlocks(entry)

  for (const [index, block] of toolUseBlocks.entries()) {
    const toolUseId = getString(block.id)
    const toolName = getString(block.name)

    if (!toolUseId || !toolName) continue

    const input = isRecord(block.input) ? block.input : {}

    const toolCall: ToolCallEvent = {
      type: 'tool_call',
      id: `${entry.index}:assistant:tool:${index}`,
      toolUseId,
      assistantUuid: getEntryUuid(entry),
      timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
      toolName,
      displayName: toolName,
      source: toolName.startsWith('mcp__') ? 'mcp' : 'native',
      input,
      commentLabel: deriveToolLabel(toolName, input),
      mcpServerName: toolName.startsWith('mcp__')
        ? toolName.split('__')[1]
        : undefined,
    }

    events.push(toolCall)
  }

  if (!assistantText && toolUseBlocks.length === 0 && message) {
    const fallbackText = extractTextContent(message.content)

    if (fallbackText) {
      events.push({
        type: 'assistant_message',
        id: `${entry.index}:assistant:fallback`,
        uuid: getEntryUuid(entry),
        parentUuid: getString(entry.raw.parentUuid),
        timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
        text: fallbackText,
        isMeta: true,
        isApiErrorMessage: false,
      })
    }
  }

  return events
}

const buildUserEvents = (
  entry: ParsedRawEntry,
  assetIdByAbsolutePath: Map<string, string>,
): CanonicalEvent[] => {
  const content = getMessage(entry)?.content

  if (typeof content === 'string') {
    const normalized = normalizeClaudeCommandText(content)

    if (normalized.machineSubtype) {
      return [
        buildSyntheticSystemNoticeFromUser(entry, normalized.machineSubtype, normalized.text ?? content),
      ]
    }

    return [
      {
        type: 'user_message',
        id: `${entry.index}:user:text`,
        uuid: getEntryUuid(entry),
        parentUuid: getString(entry.raw.parentUuid),
        timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
        text: normalized.text ?? content,
        isMeta: entry.raw.isMeta === true,
        origin: getString(entry.raw.entrypoint),
        commandInvocation: normalized.commandInvocation,
      },
    ]
  }

  const toolResultBlocks = getToolResultBlocks(entry)
  const events: CanonicalEvent[] = []

  for (const [index, block] of toolResultBlocks.entries()) {
    const toolUseId = getString(block.tool_use_id)
    if (!toolUseId) continue

    const text = extractTextContent(block.content)
    const topLevelResult = getTopLevelToolUseResult(entry)
    const persistedOutputPath = text ? extractPersistedOutputPath(text) : undefined

    const toolResult: ToolResultEvent = {
      type: 'tool_result',
      id: `${entry.index}:user:tool_result:${index}`,
      toolUseId,
      timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
      status: getToolResultStatus(block, topLevelResult),
      text,
      json: topLevelResult,
      artifactId: persistedOutputPath
        ? assetIdByAbsolutePath.get(persistedOutputPath)
        : undefined,
      mcpMeta: isRecord(entry.raw.mcpMeta) ? entry.raw.mcpMeta : undefined,
    }

    events.push(toolResult)
  }

  // Build user message text from text blocks, with image placeholders
  const textBlocks = getContentBlocks(entry).filter(block => getString(block.type) === 'text')
  const userText = extractTextContent(textBlocks)
  const imageCount = countImageBlocks(getMessageContent(entry))
  const imageSuffix = imageCount > 0
    ? `\n\n[${imageCount} image${imageCount > 1 ? 's' : ''} attached]`
    : ''

  const normalized = userText ? normalizeClaudeCommandText(userText) : undefined
  const normalizedText = normalized?.text
  const fullText = normalizedText
    ? `${normalizedText}${imageSuffix}`
    : (
        imageCount > 0
          ? `[${imageCount} image${imageCount > 1 ? 's' : ''} attached]`
          : undefined
      )

  if (fullText) {
    if (normalized?.machineSubtype) {
      events.push(
        buildSyntheticSystemNoticeFromUser(
          entry,
          normalized.machineSubtype,
          fullText,
        ),
      )
      return events
    }

    events.push({
      type: 'user_message',
      id: `${entry.index}:user:fallback`,
      uuid: getEntryUuid(entry),
      parentUuid: getString(entry.raw.parentUuid),
      timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
      text: fullText,
      isMeta: entry.raw.isMeta === true,
      origin: getString(entry.raw.entrypoint),
      commandInvocation: normalized?.commandInvocation,
    })
  }

  return events
}

const buildSystemEvent = (entry: ParsedRawEntry): CanonicalEvent | undefined => {
  const subtype = getString(entry.raw.subtype)
  const timestamp = getEntryTimestamp(entry) ?? new Date(0).toISOString()
  const contentText = getString(entry.raw.content)
  const normalizedContent = contentText
    ? normalizeClaudeCommandText(contentText)
    : undefined

  if (subtype === 'stop_hook_summary') {
    const hookInfos = Array.isArray(entry.raw.hookInfos) ? entry.raw.hookInfos : []

    const hookEvent: HookEvent = {
      type: 'hook',
      id: `${entry.index}:system:stop_hook_summary`,
      timestamp,
      hookEvent: 'stop',
      toolUseId: getString(entry.raw.toolUseID),
      label: 'stop_hook_summary',
      text: hookInfos
        .map(hookInfo =>
          isRecord(hookInfo)
            ? `${getString(hookInfo.command) ?? 'unknown'} (${getString(hookInfo.durationMs) ?? hookInfo.durationMs ?? 'n/a'}ms)`
            : undefined,
        )
        .filter((value): value is string => Boolean(value))
        .join('\n'),
      preventedContinuation:
        typeof entry.raw.preventedContinuation === 'boolean'
          ? entry.raw.preventedContinuation
          : false,
    }

    return hookEvent
  }

  const notice: SystemNoticeEvent = {
    type: 'system_notice',
    id: `${entry.index}:system:${subtype ?? 'unknown'}`,
    timestamp,
    subtype: subtype ?? 'unknown',
    level: getString(entry.raw.level) as SystemNoticeEvent['level'] | undefined,
    text:
      normalizedContent?.text ??
      extractTextContent(entry.raw.message) ??
      contentText ??
      getString(entry.raw.stopReason) ??
      subtype ??
      'system notice',
    data: entry.raw,
    commandInvocation: normalizedContent?.commandInvocation,
  }

  return notice
}

const buildSyntheticSystemNoticeFromUser = (
  entry: ParsedRawEntry,
  subtype: 'local_command_output' | 'bash_output' | 'task_notification',
  text: string,
): SystemNoticeEvent => ({
  type: 'system_notice',
  id: `${entry.index}:user:${subtype}`,
  timestamp: getEntryTimestamp(entry) ?? new Date(0).toISOString(),
  subtype,
  text,
  data: entry.raw,
})

const getToolResultStatus = (
  block: Record<string, unknown>,
  topLevelResult: unknown,
): ToolResultEvent['status'] => {
  if (block.is_error === true) {
    return 'error'
  }

  if (isRecord(topLevelResult) && topLevelResult.interrupted === true) {
    return 'partial'
  }

  return 'ok'
}

// Derive a human-readable label from tool input when no explicit description exists
const deriveToolLabel = (toolName: string, input: Record<string, unknown>): string | undefined => {
  const explicit = getString(input.description)
  if (explicit) return explicit

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return getString(input.file_path)
    case 'Glob':
      return getString(input.pattern)
    case 'Grep': {
      const pattern = getString(input.pattern)
      const grepPath = getString(input.path)
      return pattern ? (grepPath ? `${pattern} in ${grepPath}` : pattern) : undefined
    }
    case 'Bash':
    case 'PowerShell': {
      const command = getString(input.command)
      return command ? truncateLabel(command, 80) : undefined
    }
    case 'Agent':
      return truncateLabel(getString(input.description) ?? getString(input.prompt), 80)
    case 'Skill': {
      const skill = getString(input.skill) ?? getString(input.skillName)
      return skill ? `/${skill}` : undefined
    }
    case 'TaskCreate':
      return getString(input.subject)
    case 'TaskUpdate':
      return getString(input.taskId) ? `#${getString(input.taskId)} → ${getString(input.status) ?? 'update'}` : undefined
    case 'ToolSearch':
      return getString(input.query)
    case 'WebSearch':
      return getString(input.query)
    case 'WebFetch':
      return getString(input.url)
    default:
      return undefined
  }
}

const truncateLabel = (text: string | undefined, maxLength: number): string | undefined => {
  if (!text) return undefined
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}
