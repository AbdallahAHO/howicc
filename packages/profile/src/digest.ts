import type {
  CanonicalSession,
  SessionDigest,
  SessionDigestMcpServer,
  SessionDigestModelUsage,
  SessionDigestPrLink,
  SessionDigestRepository,
  SessionDigestSkill,
  SessionType,
  ToolCallEvent,
  ToolCategory,
} from '@howicc/canonical'
import { categorizeToolName, emptyToolCategories, normalizeMcpServerName } from '@howicc/canonical'

type ClaudeCodeProviderData = {
  metrics?: {
    turnCount?: number
    durationMs?: number
    modelsUsed?: string[]
    usageTimeline?: Array<{
      model: string
      inputTokens: number
      outputTokens: number
    }>
    estimatedCostUsd?: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
    inputTokens?: number
  }
  digestHints?: {
    agentVersion?: string
    mcpServersConfigured?: string[]
    prLinks?: SessionDigestPrLink[]
    repository?: SessionDigestRepository
    apiErrors?: Array<{ type: string; count: number }>
    activeDurationMs?: number
    cacheHitRate?: number
  }
}

const getClaudeCodeData = (session: CanonicalSession): ClaudeCodeProviderData | undefined =>
  session.providerData?.claudeCode as ClaudeCodeProviderData | undefined

/**
 * Extract a lightweight SessionDigest from a CanonicalSession.
 * Provider-neutral where possible, with CC-specific enrichment from providerData.
 */
export const extractSessionDigest = (session: CanonicalSession): SessionDigest => {
  const ccData = getClaudeCodeData(session)
  const metrics = ccData?.metrics
  const hints = ccData?.digestHints

  const toolCategories = emptyToolCategories()
  const mcpServerCalls = new Map<string, number>()
  const skillCalls = new Map<string, number>()
  const commandCalls = new Map<string, number>()
  const filesChangedSet = new Set<string>()
  const filesReadSet = new Set<string>()
  const fileEditCounts: Record<string, number> = {}
  const languageCounts: Record<string, number> = {}
  let errorCount = 0
  let interruptionCount = 0
  let compactionCount = 0
  let gitCommits = 0
  let gitPushes = 0

  // Collect toolUseIds from tool_decision artifacts so we can separate
  // user rejections from genuine tool errors. Only count artifacts that
  // have toolUseIds — those without can't be correlated, so they're
  // counted as rejections but don't suppress error counting.
  const rejectedToolUseIds = new Set<string>()
  let rejectionsWithIds = 0
  let rejectionsWithoutIds = 0

  for (const artifact of session.artifacts) {
    if (artifact.artifactType !== 'tool_decision') continue
    const ids = artifact.source.toolUseIds
    if (ids && ids.length > 0) {
      for (const id of ids) rejectedToolUseIds.add(id)
      rejectionsWithIds += 1
    } else {
      rejectionsWithoutIds += 1
    }
  }

  for (const event of session.events) {
    if (event.type === 'tool_call') {
      const cat = categorizeToolName(event.toolName, event.source)
      toolCategories[cat] += 1

      if (event.source === 'mcp' && event.mcpServerName) {
        const normalizedServer = normalizeMcpServerName(event.mcpServerName)
        mcpServerCalls.set(
          normalizedServer,
          (mcpServerCalls.get(normalizedServer) ?? 0) + 1,
        )
      }

      if (event.toolName === 'Skill') {
        const skillName = extractSkillName(event)
        if (skillName) {
          skillCalls.set(skillName, (skillCalls.get(skillName) ?? 0) + 1)
        }
      }

      // File change tracking from tool inputs
      const input = event.input as Record<string, unknown> | undefined
      if (input) {
        const filePath = typeof input.file_path === 'string' ? input.file_path : undefined

        if (filePath) {
          if (event.toolName === 'Edit' || event.toolName === 'Write') {
            trackFileChange(filePath, filesChangedSet, fileEditCounts, languageCounts)
          } else if (event.toolName === 'Read') {
            filesReadSet.add(filePath)
          }
        }

        // MultiEdit has edits array with per-file entries
        if (event.toolName === 'MultiEdit' && Array.isArray(input.edits)) {
          for (const edit of input.edits as Array<Record<string, unknown>>) {
            const editPath = typeof edit.file_path === 'string' ? edit.file_path : undefined
            if (editPath) {
              trackFileChange(editPath, filesChangedSet, fileEditCounts, languageCounts)
            }
          }
        }

        // Git activity from Bash commands
        if (event.toolName === 'Bash' || event.toolName === 'PowerShell') {
          const command = typeof input.command === 'string' ? input.command : ''
          if (/\bgit\s+commit\b/.test(command)) gitCommits += 1
          if (/\bgit\s+push\b/.test(command)) gitPushes += 1
        }
      }
    }

    if (
      event.type === 'user_message' &&
      event.commandInvocation?.kind === 'slash_command'
    ) {
      commandCalls.set(
        event.commandInvocation.name,
        (commandCalls.get(event.commandInvocation.name) ?? 0) + 1,
      )
    }

    // Count only genuine tool errors, not user rejections
    if (event.type === 'tool_result' && event.status === 'error') {
      if (!rejectedToolUseIds.has(event.toolUseId)) {
        errorCount += 1
      }
    }

    if (event.type === 'user_message' && event.text.includes('[Request interrupted by user')) {
      interruptionCount += 1
    }

    if (event.type === 'compact_boundary') {
      compactionCount += 1
    }
  }

  const rejectionCount = rejectionsWithIds + rejectionsWithoutIds
  const hasPlan = session.artifacts.some(a => a.artifactType === 'plan')
  const hasThinking = session.events.some(
    e => e.type === 'assistant_message' && e.isMeta === true,
  )

  const models = aggregateModelUsage(metrics?.usageTimeline ?? [])

  const mcpServersUsed: SessionDigestMcpServer[] = [...mcpServerCalls.entries()].map(
    ([server, toolCallCount]) => ({ server, toolCallCount }),
  )

  const skillsTriggered: SessionDigestSkill[] = [...skillCalls.entries()].map(
    ([name, invocationCount]) => ({ name, invocationCount }),
  )
  const commandsInvoked = [...commandCalls.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, invocationCount]) => ({ name, invocationCount }))

  const durationMs = hints?.activeDurationMs ?? metrics?.durationMs
  const createdDate = new Date(session.metadata.createdAt)

  // File iteration depth: average edits per changed file
  const fileIterationDepth = filesChangedSet.size > 0
    ? Object.values(fileEditCounts).reduce((a, b) => a + b, 0) / filesChangedSet.size
    : 0

  // Time to first edit: ms from first user message to first write tool call
  const timeToFirstEditMs = computeTimeToFirstEdit(session.events)

  // Session type classification — use self-consistent denominator from our
  // own category counts, not session.stats.toolRunCount which may differ
  const categorizedTotal = Object.values(toolCategories).reduce((a, b) => a + b, 0)
  const sessionType = classifySessionType(toolCategories, categorizedTotal)

  // API errors from digest hints
  const apiErrorTypes: Record<string, number> = {}
  let apiErrorCount = 0
  for (const err of hints?.apiErrors ?? []) {
    apiErrorTypes[err.type] = (apiErrorTypes[err.type] ?? 0) + err.count
    apiErrorCount += err.count
  }

  return {
    sessionId: session.source.sessionId,
    provider: session.provider,
    agentVersion: hints?.agentVersion,
    projectKey: session.source.projectKey,
    projectPath: session.metadata.cwd,
    gitBranch: session.metadata.gitBranch,
    title: session.metadata.title,
    createdAt: session.metadata.createdAt,
    updatedAt: session.metadata.updatedAt,
    durationMs,
    dayOfWeek: createdDate.getDay(),
    turnCount: metrics?.turnCount ?? 0,
    messageCount: session.stats.visibleMessageCount,
    toolRunCount: session.stats.toolRunCount,
    toolCategories,
    errorCount,
    apiErrorCount,
    apiErrorTypes,
    rejectionCount,
    interruptionCount,
    compactionCount,
    subagentCount: session.stats.subagentCount,
    hasPlan,
    hasThinking,
    models,
    estimatedCostUsd: metrics?.estimatedCostUsd,
    hourOfDay: createdDate.getHours(),
    sessionType,
    filesChanged: [...filesChangedSet],
    filesRead: [...filesReadSet],
    languages: languageCounts,
    fileIterationDepth,
    timeToFirstEditMs,
    gitCommits,
    gitPushes,
    repository: hints?.repository,
    prLinks: hints?.prLinks ?? [],
    mcpServersConfigured: hints?.mcpServersConfigured ?? [],
    mcpServersUsed,
    skillsTriggered,
    commandsInvoked,
    providerDigest: ccData
      ? {
          cacheHitRate: hints?.cacheHitRate,
          activeDurationMs: hints?.activeDurationMs,
        }
      : undefined,
  }
}

const trackFileChange = (
  filePath: string,
  filesChangedSet: Set<string>,
  fileEditCounts: Record<string, number>,
  languageCounts: Record<string, number>,
) => {
  filesChangedSet.add(filePath)
  fileEditCounts[filePath] = (fileEditCounts[filePath] ?? 0) + 1
  const ext = extractFileExtension(filePath)
  if (ext) languageCounts[ext] = (languageCounts[ext] ?? 0) + 1
}

const extractFileExtension = (filePath: string): string | undefined => {
  const basename = filePath.split('/').pop() ?? ''
  if (!basename.includes('.')) return undefined
  const ext = basename.split('.').pop()?.toLowerCase()
  if (!ext || ext.length > 10) return undefined
  return ext
}

const extractSkillName = (event: ToolCallEvent): string | undefined => {
  const input = event.input as Record<string, unknown> | undefined
  if (!input) return undefined
  const name = input.skill ?? input.skillName
  return typeof name === 'string' ? name : undefined
}

const classifySessionType = (
  categories: Record<ToolCategory, number>,
  totalRuns: number,
): SessionType => {
  if (totalRuns === 0) return 'mixed'

  const writePct = (categories.write ?? 0) / totalRuns
  const commandPct = (categories.command ?? 0) / totalRuns
  const readPct = (categories.read ?? 0) / totalRuns
  const searchPct = (categories.search ?? 0) / totalRuns

  if (writePct > 0.4) return 'building'
  if (commandPct > 0.5) return 'debugging'
  if (readPct > 0.5) return 'exploring'
  if (searchPct > 0.3) return 'investigating'
  return 'mixed'
}

const computeTimeToFirstEdit = (
  events: CanonicalSession['events'],
): number | undefined => {
  let firstUserTs: number | undefined
  let firstEditTs: number | undefined

  for (const event of events) {
    if (event.type === 'user_message' && !firstUserTs && event.timestamp) {
      firstUserTs = new Date(event.timestamp).getTime()
    }
    if (
      event.type === 'tool_call' &&
      (event.toolName === 'Edit' || event.toolName === 'Write' || event.toolName === 'MultiEdit') &&
      !firstEditTs &&
      event.timestamp
    ) {
      firstEditTs = new Date(event.timestamp).getTime()
    }
    if (firstUserTs && firstEditTs) break
  }

  if (firstUserTs && firstEditTs && firstEditTs > firstUserTs) {
    return firstEditTs - firstUserTs
  }
  return undefined
}

const aggregateModelUsage = (
  timeline: Array<{ model: string; inputTokens: number; outputTokens: number }>,
): SessionDigestModelUsage[] => {
  const map = new Map<string, { inputTokens: number; outputTokens: number }>()

  for (const entry of timeline) {
    // Skip synthetic/placeholder models that have no real usage data
    if (entry.model.startsWith('<')) continue

    const existing = map.get(entry.model) ?? { inputTokens: 0, outputTokens: 0 }
    existing.inputTokens += entry.inputTokens
    existing.outputTokens += entry.outputTokens
    map.set(entry.model, existing)
  }

  return [...map.entries()].map(([model, usage]) => ({ model, ...usage }))
}
