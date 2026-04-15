import type { ProviderId } from './provider'

export type ArtifactSourceRef = {
  eventIds?: string[]
  toolUseIds?: string[]
  assetIds?: string[]
  agentId?: string
}

export type ArtifactBase = {
  id: string
  artifactType: string
  provider: ProviderId
  source: ArtifactSourceRef
  createdAt?: string
  updatedAt?: string
  providerData?: Record<string, unknown>
}

export type PlanArtifact = ArtifactBase & {
  artifactType: 'plan'
  role: 'main' | 'subagent'
  resolutionSource:
    | 'file'
    | 'file_snapshot'
    | 'attachment'
    | 'tool_use'
    | 'tool_result'
    | 'user_message'
  slug?: string
  filePath?: string
  content: string
}

export type QuestionArtifact = ArtifactBase & {
  artifactType: 'question_interaction'
  outcome: 'answered' | 'declined' | 'redirected' | 'finished_plan_interview'
  questions: Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description: string
      preview?: string
    }>
    multiSelect: boolean
  }>
  answers?: Record<string, string>
  annotations?: Record<string, { preview?: string; notes?: string }>
  feedbackText?: string
}

export type ToolDecisionArtifact = ArtifactBase & {
  artifactType: 'tool_decision'
  toolName: string
  status: 'rejected' | 'redirected' | 'aborted' | 'hook_blocked' | 'interrupted'
  feedbackText?: string
  isErrorResult: boolean
}

export type ToolOutputArtifact = ArtifactBase & {
  artifactType: 'tool_output'
  toolName: string
  status: 'ok' | 'error' | 'partial'
  previewText?: string
  fullOutputAssetId?: string
}

export type TodoSnapshotArtifact = ArtifactBase & {
  artifactType: 'todo_snapshot'
  todos: Array<{
    content: string
    status: string
    activeForm?: string
    priority?: string
  }>
}

export type TaskStatusTimelineArtifact = ArtifactBase & {
  artifactType: 'task_status_timeline'
  entries: Array<{
    taskId: string
    taskType: string
    status: string
    description: string
    deltaSummary?: string | null
    outputFilePath?: string
    timestamp?: string
  }>
}

export type McpResourceArtifact = ArtifactBase & {
  artifactType: 'mcp_resource'
  server: string
  uri: string
  name: string
  description?: string
  textAssetId?: string
  blobAssetId?: string
}

export type StructuredOutputArtifact = ArtifactBase & {
  artifactType: 'structured_output'
  data: unknown
}

export type InvokedSkillSetArtifact = ArtifactBase & {
  artifactType: 'invoked_skill_set'
  skills: Array<{
    name: string
    path: string
    contentAssetId?: string
    inlineContent?: string
  }>
}

export type BriefDeliveryArtifact = ArtifactBase & {
  artifactType: 'brief_delivery'
  message: string
  status: 'normal' | 'proactive'
  attachments: Array<{
    path: string
    size: number
    isImage: boolean
    fileUuid?: string
    assetId?: string
  }>
}

export type SessionArtifact =
  | PlanArtifact
  | QuestionArtifact
  | ToolDecisionArtifact
  | ToolOutputArtifact
  | TodoSnapshotArtifact
  | TaskStatusTimelineArtifact
  | McpResourceArtifact
  | StructuredOutputArtifact
  | InvokedSkillSetArtifact
  | BriefDeliveryArtifact
