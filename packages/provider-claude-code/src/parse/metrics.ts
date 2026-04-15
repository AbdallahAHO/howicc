import type { ModelUsageEntry, OpenRouterCatalog, SessionCostEstimate } from '@howicc/model-pricing'
import { estimateClaudeConversationCost } from '@howicc/model-pricing'
import type { ParsedRawEntry } from '../jsonl'
import {
  extractTextContent,
  getEntryTimestamp,
  getEntryType,
  getEntryUuid,
  getMessageContent,
  getMessageModel,
  getMessageUsage,
  getPermissionMode,
  getToolUseBlocks,
  getTopLevelToolUseResult,
} from './raw'
import { normalizeClaudeCommandText } from './commandText'

type ModelTimelineEntry = {
  model: string
  timestamp?: string
}

type ModelSelectionTimelineEntry = {
  modelLabel: string
  timestamp?: string
  source: 'local_command_output'
}

type ModeTimelineEntry = {
  mode: string
  timestamp?: string
}

type SessionModeTimelineEntry = {
  mode: string
  event: 'set' | 'enter' | 'exit'
  timestamp?: string
  source: 'mode_entry' | 'tool_event'
}

type ClaudeCodeMetrics = {
  messageCount: number
  turnCount: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  startedAt?: string
  endedAt?: string
  durationMs?: number
  modelsUsed: string[]
  modelTimeline: ModelTimelineEntry[]
  modelSelectionTimeline: ModelSelectionTimelineEntry[]
  usageTimeline: ModelUsageEntry[]
  permissionModeTimeline: ModeTimelineEntry[]
  sessionModeTimeline: SessionModeTimelineEntry[]
  estimatedCostUsd?: number
  costReliability: SessionCostEstimate['reliability']
  pricing?: SessionCostEstimate
}

export const buildClaudeCodeMetrics = (
  entries: ParsedRawEntry[],
  options?: { catalog?: OpenRouterCatalog; selectedEntries?: ParsedRawEntry[] },
): ClaudeCodeMetrics => {
  const mainEntries = entries.filter(entry => entry.raw.isSidechain !== true)

  // For turn counting, use selected entries (active thread) when available
  // to avoid counting promptIds from dead branches (user-edited prompts)
  const entriesForTurnCount = options?.selectedEntries ?? mainEntries
  const timestamps = mainEntries
    .map(getEntryTimestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort()

  let lastModel: string | undefined
  let lastSelectedModelLabel: string | undefined
  let lastPermissionMode: string | undefined
  let lastSessionMode: string | undefined

  const modelTimeline: ModelTimelineEntry[] = []
  const modelSelectionTimeline: ModelSelectionTimelineEntry[] = []
  const permissionModeTimeline: ModeTimelineEntry[] = []
  const sessionModeTimeline: SessionModeTimelineEntry[] = []
  const modelsUsed = new Set<string>()

  // Collect promptIds from selected thread only to exclude dead branches
  const promptIds = new Set<string>()
  for (const entry of entriesForTurnCount) {
    const promptId = typeof entry.raw.promptId === 'string' ? entry.raw.promptId : undefined
    if (promptId) promptIds.add(promptId)
  }

  let messageCount = 0

  // Collect per-API-response usage by deduplicating consecutive assistant entries.
  // CC splits one API response into multiple JSONL entries (one per content block:
  // thinking, text, tool_use, tool_use...). Each entry carries the same or growing
  // usage snapshot. input_tokens and cache tokens are fixed per API call, so summing
  // all entries overcounts by the number of content blocks. We group consecutive
  // assistant entries with matching (input_tokens, cache_write, cache_read) and only
  // take the last entry per group (which has the final output_tokens).
  const deduplicatedUsage: Array<{
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
    model?: string
    eventId: string
    timestamp?: string
  }> = []

  let currentResponseKey: string | undefined
  let currentResponseUsage: typeof deduplicatedUsage[number] | undefined

  const flushCurrentResponse = () => {
    if (currentResponseUsage) {
      deduplicatedUsage.push(currentResponseUsage)
      currentResponseUsage = undefined
      currentResponseKey = undefined
    }
  }

  for (const entry of mainEntries) {
    const entryType = getEntryType(entry)
    if (entryType === 'user' || entryType === 'assistant' || entryType === 'system') {
      messageCount += 1
    }

    const model = getMessageModel(entry)
    if (model) {
      modelsUsed.add(model)
      if (model !== lastModel) {
        modelTimeline.push({ model, timestamp: getEntryTimestamp(entry) })
        lastModel = model
      }
    }

    const selectedModelLabel = extractSelectedModelLabel(entry)
    if (selectedModelLabel && selectedModelLabel !== lastSelectedModelLabel) {
      modelSelectionTimeline.push({
        modelLabel: selectedModelLabel,
        timestamp: getEntryTimestamp(entry),
        source: 'local_command_output',
      })
      lastSelectedModelLabel = selectedModelLabel
    }

    const permissionMode = getPermissionMode(entry)
    if (permissionMode && permissionMode !== lastPermissionMode) {
      permissionModeTimeline.push({
        mode: permissionMode,
        timestamp: getEntryTimestamp(entry),
      })
      lastPermissionMode = permissionMode
    }

    const explicitMode = typeof entry.raw.mode === 'string' ? entry.raw.mode : undefined
    if (entry.raw.type === 'mode' && explicitMode && explicitMode !== lastSessionMode) {
      sessionModeTimeline.push({
        mode: explicitMode,
        event: 'set',
        timestamp: getEntryTimestamp(entry),
        source: 'mode_entry',
      })
      lastSessionMode = explicitMode
    }

    const toolUseResult = getTopLevelToolUseResult(entry)
    if (
      entryType === 'user' &&
      toolUseResult &&
      typeof toolUseResult === 'object' &&
      (toolUseResult as Record<string, unknown>).message ===
        'Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.'
    ) {
      sessionModeTimeline.push({
        mode: 'plan',
        event: 'enter',
        timestamp: getEntryTimestamp(entry),
        source: 'tool_event',
      })
      lastSessionMode = 'plan'
    }

    if (
      entryType === 'assistant' &&
      getToolUseBlocks(entry).some(block => block.name === 'ExitPlanMode')
    ) {
      sessionModeTimeline.push({
        mode: 'plan',
        event: 'exit',
        timestamp: getEntryTimestamp(entry),
        source: 'tool_event',
      })
    }

    // Non-assistant entries break the current response group
    if (entryType !== 'assistant') {
      flushCurrentResponse()
      continue
    }

    const usage = getMessageUsage(entry)
    if (!usage) continue

    const inputValue = getNumber(usage.input_tokens)
    const cacheWriteValue = getNumber(usage.cache_creation_input_tokens)
    const cacheReadValue = getNumber(usage.cache_read_input_tokens)
    const outputValue = getNumber(usage.output_tokens)

    // Key by the values that are fixed per API call
    const responseKey = `${inputValue}:${cacheWriteValue}:${cacheReadValue}`

    if (responseKey === currentResponseKey && currentResponseUsage) {
      // Same API response — update with latest output_tokens (grows during streaming)
      currentResponseUsage.outputTokens = Math.max(currentResponseUsage.outputTokens, outputValue)
      currentResponseUsage.eventId = getEntryUuid(entry) ?? `${entry.index}`
      currentResponseUsage.timestamp = getEntryTimestamp(entry)
      if (model) currentResponseUsage.model = model
    } else {
      flushCurrentResponse()
      currentResponseKey = responseKey
      currentResponseUsage = {
        inputTokens: inputValue,
        outputTokens: outputValue,
        cacheCreationInputTokens: cacheWriteValue,
        cacheReadInputTokens: cacheReadValue,
        model,
        eventId: getEntryUuid(entry) ?? `${entry.index}`,
        timestamp: getEntryTimestamp(entry),
      }
    }
  }
  flushCurrentResponse()

  let inputTokens = 0
  let outputTokens = 0
  let cacheCreationInputTokens = 0
  let cacheReadInputTokens = 0
  const usageTimeline: ModelUsageEntry[] = []

  for (const usage of deduplicatedUsage) {
    inputTokens += usage.inputTokens
    outputTokens += usage.outputTokens
    cacheCreationInputTokens += usage.cacheCreationInputTokens
    cacheReadInputTokens += usage.cacheReadInputTokens

    if (usage.model) {
      usageTimeline.push({
        eventId: usage.eventId,
        timestamp: usage.timestamp,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheWriteInputTokens: usage.cacheCreationInputTokens,
      })
    }
  }

  const startedAt = timestamps[0]
  const endedAt = timestamps[timestamps.length - 1]

  const pricing = options?.catalog
    ? estimateClaudeConversationCost({
        usageEntries: usageTimeline,
        catalog: options.catalog,
      })
    : undefined

  return {
    messageCount,
    turnCount: promptIds.size,
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    startedAt,
    endedAt,
    durationMs:
      startedAt && endedAt
        ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
        : undefined,
    modelsUsed: [...modelsUsed],
    modelTimeline,
    modelSelectionTimeline,
    usageTimeline,
    permissionModeTimeline,
    sessionModeTimeline,
    estimatedCostUsd: pricing?.estimatedCostUsd,
    costReliability: pricing?.reliability ?? 'not_available',
    pricing,
  }
}

const getNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const extractSelectedModelLabel = (entry: ParsedRawEntry): string | undefined => {
  const content = typeof entry.raw.content === 'string'
    ? entry.raw.content
    : extractTextContent(getMessageContent(entry))

  const normalized = normalizeClaudeCommandText(content)
  if (normalized.machineSubtype !== 'local_command_output') {
    return undefined
  }

  const match = normalized.text?.match(/^Set model to\s+(.+)$/i)
  return match?.[1]?.trim()
}
