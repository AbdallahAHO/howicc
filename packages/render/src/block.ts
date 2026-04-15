export type MessageBlock = {
  type: 'message'
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type QuestionBlock = {
  type: 'question'
  id: string
  title: string
  questions: Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description: string
      preview?: string
    }>
    answer?: string
    notes?: string
    selectedPreview?: string
    multiSelect: boolean
  }>
  outcome: 'answered' | 'declined' | 'redirected' | 'finished_plan_interview'
  feedbackText?: string
  defaultCollapsed: boolean
}

export type ToolRunActivity = {
  type: 'tool_run'
  id: string
  toolUseId: string
  toolName: string
  source: 'native' | 'mcp'
  title: string
  inputPreview?: string
  outputPreview?: string
  artifactId?: string
  status: 'ok' | 'error' | 'partial'
}

export type HookActivity = {
  type: 'hook_event'
  id: string
  title: string
  body?: string
  tone: 'info' | 'warning' | 'error'
}

export type ActivityGroupBlock = {
  type: 'activity_group'
  id: string
  label: string
  defaultCollapsed: boolean
  summary?: string
  items: Array<ToolRunActivity | HookActivity>
}

export type CalloutBlock = {
  type: 'callout'
  id: string
  tone: 'info' | 'warning' | 'error'
  title: string
  body?: string
}

export type TodoBlock = {
  type: 'todo_snapshot'
  id: string
  title: string
  items: Array<{
    content: string
    status: string
    priority?: string
  }>
  defaultCollapsed: boolean
}

export type TaskTimelineBlock = {
  type: 'task_timeline'
  id: string
  title: string
  entries: Array<{
    taskId: string
    status: string
    description: string
    deltaSummary?: string | null
  }>
  defaultCollapsed: boolean
}

export type ResourceBlock = {
  type: 'resource'
  id: string
  title: string
  server?: string
  uri?: string
  previewText?: string
  assetId?: string
  defaultCollapsed: boolean
}

export type StructuredDataBlock = {
  type: 'structured_data'
  id: string
  title: string
  data: unknown
  defaultCollapsed: boolean
}

export type BriefDeliveryBlock = {
  type: 'brief_delivery'
  id: string
  title: string
  message: string
  attachments: Array<{
    label: string
    assetId?: string
    fileUuid?: string
  }>
  defaultCollapsed: boolean
}

export type SubagentThreadBlock = {
  type: 'subagent_thread'
  id: string
  title: string
  defaultCollapsed: boolean
  blocks: RenderBlock[]
}

export type CompactBoundaryBlock = {
  type: 'compact_boundary'
  id: string
  text: string
}

export type RenderBlock =
  | MessageBlock
  | QuestionBlock
  | ActivityGroupBlock
  | CalloutBlock
  | TodoBlock
  | TaskTimelineBlock
  | ResourceBlock
  | StructuredDataBlock
  | BriefDeliveryBlock
  | SubagentThreadBlock
  | CompactBoundaryBlock
