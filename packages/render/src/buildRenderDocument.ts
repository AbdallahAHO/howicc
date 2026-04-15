import type {
  BriefDeliveryArtifact,
  CanonicalSession,
  CompactBoundaryEvent,
  HookEvent,
  McpResourceArtifact,
  PlanArtifact,
  QuestionArtifact,
  SessionArtifact,
  StructuredOutputArtifact,
  SystemNoticeEvent,
  TaskStatusTimelineArtifact,
  TodoSnapshotArtifact,
  ToolCallEvent,
  ToolDecisionArtifact,
  ToolOutputArtifact,
  ToolResultEvent,
} from '@howicc/canonical'
import type {
  ActivityGroupBlock,
  BriefDeliveryBlock,
  CalloutBlock,
  CompactBoundaryBlock,
  HookActivity,
  MessageBlock,
  QuestionBlock,
  RenderBlock,
  ResourceBlock,
  StructuredDataBlock,
  SubagentThreadBlock,
  TaskTimelineBlock,
  TodoBlock,
  ToolRunActivity,
} from './block'
import type { RenderDocument } from './document'

const isPlanArtifact = (artifact: SessionArtifact): artifact is PlanArtifact =>
  artifact.artifactType === 'plan'

const isQuestionArtifact = (
  artifact: SessionArtifact,
): artifact is QuestionArtifact => artifact.artifactType === 'question_interaction'

const isTodoArtifact = (
  artifact: SessionArtifact,
): artifact is TodoSnapshotArtifact => artifact.artifactType === 'todo_snapshot'

const isToolDecisionArtifact = (
  artifact: SessionArtifact,
): artifact is ToolDecisionArtifact => artifact.artifactType === 'tool_decision'

const isToolOutputArtifact = (
  artifact: SessionArtifact,
): artifact is ToolOutputArtifact => artifact.artifactType === 'tool_output'

const isTaskTimelineArtifact = (
  artifact: SessionArtifact,
): artifact is TaskStatusTimelineArtifact =>
  artifact.artifactType === 'task_status_timeline'

const isMcpResourceArtifact = (
  artifact: SessionArtifact,
): artifact is McpResourceArtifact => artifact.artifactType === 'mcp_resource'

const isStructuredOutputArtifact = (
  artifact: SessionArtifact,
): artifact is StructuredOutputArtifact => artifact.artifactType === 'structured_output'

const isBriefDeliveryArtifact = (
  artifact: SessionArtifact,
): artifact is BriefDeliveryArtifact => artifact.artifactType === 'brief_delivery'

const buildMessageBlock = (
  role: MessageBlock['role'],
  id: string,
  text: string,
): MessageBlock => ({
  type: 'message',
  id,
  role,
  text,
})

const buildQuestionBlock = (artifact: QuestionArtifact): QuestionBlock => ({
  type: 'question',
  id: artifact.id,
  title: 'Questions for the user',
  questions: artifact.questions.map(question => {
    const answer = artifact.answers?.[question.header]
    const annotation = artifact.annotations?.[question.header]

    return {
      ...question,
      answer,
      notes: annotation?.notes,
      selectedPreview: annotation?.preview,
    }
  }),
  outcome: artifact.outcome,
  feedbackText: artifact.feedbackText,
  defaultCollapsed: artifact.outcome !== 'answered',
})

const buildTodoBlock = (artifact: TodoSnapshotArtifact): TodoBlock => ({
  type: 'todo_snapshot',
  id: artifact.id,
  title: 'Todo snapshot',
  items: artifact.todos.map(todo => ({
    content: todo.content,
    status: todo.status,
    priority: todo.priority,
  })),
  defaultCollapsed: true,
})

const buildToolDecisionCallout = (
  artifact: ToolDecisionArtifact,
): CalloutBlock => ({
  type: 'callout',
  id: artifact.id,
  tone:
    artifact.status === 'hook_blocked' || artifact.status === 'interrupted'
      ? 'error'
      : 'warning',
  title: `${artifact.toolName} ${decisionTitleSuffix(artifact.status)}`,
  body: artifact.feedbackText,
})

const buildTaskTimelineBlock = (
  artifact: TaskStatusTimelineArtifact,
): TaskTimelineBlock => ({
  type: 'task_timeline',
  id: artifact.id,
  title: 'Task timeline',
  entries: artifact.entries.map(entry => ({
    taskId: entry.taskId,
    status: entry.status,
    description: entry.description,
    deltaSummary: entry.deltaSummary,
  })),
  defaultCollapsed: true,
})

const buildResourceBlock = (
  artifact: McpResourceArtifact,
): ResourceBlock => ({
  type: 'resource',
  id: artifact.id,
  title: artifact.name,
  server: artifact.server,
  uri: artifact.uri,
  previewText: artifact.description,
  assetId: artifact.textAssetId ?? artifact.blobAssetId,
  defaultCollapsed: true,
})

const buildStructuredDataBlock = (
  artifact: StructuredOutputArtifact,
): StructuredDataBlock => ({
  type: 'structured_data',
  id: artifact.id,
  title: 'Structured output',
  data: artifact.data,
  defaultCollapsed: true,
})

const buildBriefDeliveryBlock = (
  artifact: BriefDeliveryArtifact,
): BriefDeliveryBlock => ({
  type: 'brief_delivery',
  id: artifact.id,
  title: artifact.status === 'proactive' ? 'Proactive delivery' : 'Delivery',
  message: artifact.message,
  attachments: artifact.attachments.map(attachment => ({
    label: attachment.path.split('/').pop() ?? attachment.path,
    assetId: attachment.assetId,
    fileUuid: attachment.fileUuid,
  })),
  defaultCollapsed: true,
})

const buildSystemNoticeCallout = (
  event: SystemNoticeEvent,
): CalloutBlock => ({
  type: 'callout',
  id: event.id,
  tone: event.level ?? 'info',
  title: humanizeIdentifier(event.subtype),
  body: event.text,
})

const buildCompactBoundaryBlock = (
  event: CompactBoundaryEvent,
): CompactBoundaryBlock => ({
  type: 'compact_boundary',
  id: event.id,
  text: event.text,
})

const buildToolRunActivity = (
  call: ToolCallEvent,
  result: ToolResultEvent | undefined,
  outputArtifact: ToolOutputArtifact | undefined,
): ToolRunActivity => ({
  type: 'tool_run',
  id: call.id,
  toolUseId: call.toolUseId,
  toolName: call.toolName,
  source: call.source === 'mcp' ? 'mcp' : 'native',
  title: call.commentLabel ?? call.displayName,
  inputPreview: call.commentLabel ? undefined : truncatePreview(safeJson(call.input), 240),
  outputPreview: truncatePreview(
    outputArtifact?.previewText ?? result?.text ?? safeJson(result?.json),
    400,
  ),
  artifactId: outputArtifact?.fullOutputAssetId ?? result?.artifactId,
  status: result?.status ?? 'partial',
})

const buildHookActivity = (event: HookEvent): HookActivity => ({
  type: 'hook_event',
  id: event.id,
  title: humanizeIdentifier(event.label ?? event.hookEvent),
  body: event.text,
  tone:
    event.preventedContinuation || event.success === false
      ? 'error'
      : event.hookEvent === 'stop'
        ? 'warning'
        : 'info',
})

const buildActivityGroupBlock = (
  items: Array<ToolRunActivity | HookActivity>,
): ActivityGroupBlock => ({
  type: 'activity_group',
  id: `activity-group:${items[0]?.id ?? 'unknown'}`,
  label: buildActivityGroupLabel(items),
  defaultCollapsed: !items.some(
    item => item.type === 'hook_event' || item.status !== 'ok',
  ),
  summary: buildActivityGroupSummary(items),
  items,
})

const buildTimelineBlocks = (input: {
  events: CanonicalSession['events']
  artifacts: SessionArtifact[]
}): RenderBlock[] => {
  const resultByToolUseId = new Map(
    input.events
      .filter((event): event is ToolResultEvent => event.type === 'tool_result')
      .map(event => [event.toolUseId, event]),
  )

  const outputArtifactByToolUseId = new Map(
    input.artifacts
      .filter(isToolOutputArtifact)
      .flatMap(artifact =>
        (artifact.source.toolUseIds ?? []).map(toolUseId => [toolUseId, artifact] as const),
      ),
  )

  const emittedArtifactIds = new Set<string>()
  const blocks: RenderBlock[] = []
  let pendingItems: Array<ToolRunActivity | HookActivity> = []
  let pendingToolUseIds = new Set<string>()
  let pendingEventIds = new Set<string>()

  const flushPending = () => {
    if (pendingItems.length > 0) {
      blocks.push(buildActivityGroupBlock(pendingItems))
    }

    if (pendingItems.length > 0 || pendingToolUseIds.size > 0 || pendingEventIds.size > 0) {
      blocks.push(
        ...buildAnchoredArtifactBlocks(input.artifacts, {
          toolUseIds: pendingToolUseIds,
          eventIds: pendingEventIds,
          emittedArtifactIds,
        }),
      )
    }

    pendingItems = []
    pendingToolUseIds = new Set<string>()
    pendingEventIds = new Set<string>()
  }

  for (const event of input.events) {
    if (event.type === 'user_message') {
      flushPending()
      blocks.push(buildMessageBlock('user', event.id, event.text))
      continue
    }

    if (event.type === 'assistant_message') {
      flushPending()
      blocks.push(buildMessageBlock('assistant', event.id, event.text))
      continue
    }

    if (event.type === 'tool_call') {
      pendingItems.push(
        buildToolRunActivity(
          event,
          resultByToolUseId.get(event.toolUseId),
          outputArtifactByToolUseId.get(event.toolUseId),
        ),
      )
      pendingToolUseIds.add(event.toolUseId)
      pendingEventIds.add(event.id)
      continue
    }

    if (event.type === 'tool_result') {
      pendingEventIds.add(event.id)
      continue
    }

    if (event.type === 'hook') {
      pendingItems.push(buildHookActivity(event))
      if (event.toolUseId) pendingToolUseIds.add(event.toolUseId)
      pendingEventIds.add(event.id)
      continue
    }

    if (event.type === 'system_notice') {
      flushPending()
      blocks.push(buildSystemNoticeCallout(event))
      continue
    }

    if (event.type === 'compact_boundary') {
      flushPending()
      blocks.push(buildCompactBoundaryBlock(event))
      continue
    }
  }

  flushPending()
  blocks.push(...buildUnanchoredArtifactBlocks(input.artifacts, emittedArtifactIds))

  return blocks
}

const buildSubagentBlocks = (session: CanonicalSession): SubagentThreadBlock[] =>
  session.agents.map(agent => ({
    type: 'subagent_thread',
    id: `subagent:${agent.agentId}`,
    title: agent.title ?? `Subagent ${agent.agentId}`,
    defaultCollapsed: true,
    blocks: buildTimelineBlocks({
      events: agent.events,
      artifacts: session.artifacts.filter(
        artifact => artifact.source.agentId === agent.agentId,
      ),
    }),
  }))

const buildAnchoredArtifactBlocks = (
  artifacts: SessionArtifact[],
  input: {
    toolUseIds: Set<string>
    eventIds: Set<string>
    emittedArtifactIds: Set<string>
  },
): RenderBlock[] =>
  artifacts.flatMap(artifact => {
    if (input.emittedArtifactIds.has(artifact.id)) return []
    if (artifact.source.agentId) return []

    const matchesToolUse = (artifact.source.toolUseIds ?? []).some(toolUseId =>
      input.toolUseIds.has(toolUseId),
    )
    const matchesEvent = (artifact.source.eventIds ?? []).some(eventId =>
      input.eventIds.has(eventId),
    )

    if (!matchesToolUse && !matchesEvent) {
      return []
    }

    const block = buildArtifactBlock(artifact)

    if (!block) {
      return []
    }

    input.emittedArtifactIds.add(artifact.id)
    return [block]
  })

const buildUnanchoredArtifactBlocks = (
  artifacts: SessionArtifact[],
  emittedArtifactIds: Set<string>,
): RenderBlock[] =>
  artifacts.flatMap(artifact => {
    if (emittedArtifactIds.has(artifact.id)) return []
    if (artifact.source.agentId) return []

    const block = buildArtifactBlock(artifact)

    if (!block) {
      return []
    }

    emittedArtifactIds.add(artifact.id)
    return [block]
  })

const buildArtifactBlock = (artifact: SessionArtifact): RenderBlock | undefined => {
  if (isQuestionArtifact(artifact)) {
    return buildQuestionBlock(artifact)
  }

  if (isTodoArtifact(artifact)) {
    return buildTodoBlock(artifact)
  }

  if (isToolDecisionArtifact(artifact)) {
    return buildToolDecisionCallout(artifact)
  }

  if (isTaskTimelineArtifact(artifact)) {
    return buildTaskTimelineBlock(artifact)
  }

  if (isMcpResourceArtifact(artifact)) {
    return buildResourceBlock(artifact)
  }

  if (isStructuredOutputArtifact(artifact)) {
    return buildStructuredDataBlock(artifact)
  }

  if (isBriefDeliveryArtifact(artifact)) {
    return buildBriefDeliveryBlock(artifact)
  }

  return undefined
}

const decisionTitleSuffix = (status: ToolDecisionArtifact['status']) => {
  switch (status) {
    case 'hook_blocked':
      return 'was blocked'
    case 'redirected':
      return 'was redirected'
    case 'aborted':
      return 'was aborted'
    case 'interrupted':
      return 'was interrupted'
    case 'rejected':
    default:
      return 'failed'
  }
}

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, letter => letter.toUpperCase())

const safeJson = (value: unknown): string | undefined => {
  if (value == null) return undefined

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return undefined
  }
}

const truncatePreview = (value: string | undefined, maxLength: number) => {
  if (!value) return undefined
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

const buildActivityGroupLabel = (items: Array<ToolRunActivity | HookActivity>) => {
  const toolRuns = items.filter(
    (item): item is ToolRunActivity => item.type === 'tool_run',
  )

  if (toolRuns.length === 0) {
    return 'Hooks'
  }

  const counts = new Map<string, number>()

  for (const run of toolRuns) {
    counts.set(run.toolName, (counts.get(run.toolName) ?? 0) + 1)
  }

  const labelParts = [...counts.entries()].map(([toolName, count]) =>
    count > 1 ? `${toolName} x${count}` : toolName,
  )

  if (labelParts.length > 3) {
    return `${toolRuns.length} tool runs`
  }

  return labelParts.join(' · ')
}

const buildActivityGroupSummary = (items: Array<ToolRunActivity | HookActivity>) => {
  const toolRuns = items.filter(
    (item): item is ToolRunActivity => item.type === 'tool_run',
  )
  const hookCount = items.length - toolRuns.length

  if (toolRuns.length === 0) {
    return hookCount > 0 ? `${hookCount} hook ${hookCount === 1 ? 'event' : 'events'}` : undefined
  }

  const statusCounts = toolRuns.reduce(
    (counts, item) => ({
      ok: counts.ok + (item.status === 'ok' ? 1 : 0),
      error: counts.error + (item.status === 'error' ? 1 : 0),
      partial: counts.partial + (item.status === 'partial' ? 1 : 0),
    }),
    { ok: 0, error: 0, partial: 0 },
  )

  const parts = [
    statusCounts.ok > 0 ? `${statusCounts.ok} ok` : undefined,
    statusCounts.error > 0 ? `${statusCounts.error} error` : undefined,
    statusCounts.partial > 0 ? `${statusCounts.partial} partial` : undefined,
    hookCount > 0 ? `${hookCount} hook ${hookCount === 1 ? 'event' : 'events'}` : undefined,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(', ') : undefined
}

export const buildRenderDocument = (
  session: CanonicalSession,
): RenderDocument => {
  const currentPlan = session.artifacts.find(
    (artifact): artifact is PlanArtifact =>
      isPlanArtifact(artifact) && artifact.role === 'main',
  )

  const blocks: RenderBlock[] = [
    ...buildTimelineBlocks({
      events: session.events,
      artifacts: session.artifacts,
    }),
    ...buildSubagentBlocks(session),
  ]

  return {
    kind: 'render_document',
    schemaVersion: 1,
    session: {
      sessionId: session.source.sessionId,
      title:
        session.metadata.title ??
        session.metadata.customTitle ??
        session.metadata.summary ??
        session.source.sessionId,
      provider: session.provider,
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt,
      gitBranch: session.metadata.gitBranch,
      tag: session.metadata.tag,
      stats: {
        messageCount: session.stats.visibleMessageCount,
        toolRunCount: session.stats.toolRunCount,
        activityGroupCount: blocks.filter(block => block.type === 'activity_group').length,
      },
    },
    context: currentPlan
      ? {
          currentPlan: {
            title: 'Current plan',
            body: currentPlan.content,
            source:
              currentPlan.resolutionSource === 'file'
                ? 'file'
                : 'transcript_recovered',
            filePath: currentPlan.filePath,
            artifactId: currentPlan.id,
          },
        }
      : undefined,
    blocks,
  }
}
