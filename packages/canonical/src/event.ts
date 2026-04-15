export type SlashCommandInvocation = {
  kind: 'slash_command'
  name: string
  slashName: string
  args?: string
}

export type BashInputInvocation = {
  kind: 'bash_input'
  command: string
}

export type CommandInvocation = SlashCommandInvocation | BashInputInvocation

export type UserMessageEvent = {
  type: 'user_message'
  id: string
  uuid?: string
  parentUuid?: string
  timestamp: string
  text: string
  isMeta?: boolean
  origin?: string
  commandInvocation?: CommandInvocation
}

export type AssistantMessageEvent = {
  type: 'assistant_message'
  id: string
  uuid?: string
  parentUuid?: string
  timestamp: string
  text: string
  isMeta?: boolean
  isApiErrorMessage?: boolean
}

export type ToolCallEvent = {
  type: 'tool_call'
  id: string
  toolUseId: string
  assistantUuid?: string
  timestamp: string
  toolName: string
  displayName: string
  source: 'native' | 'mcp' | 'repl_virtual'
  input: unknown
  commentLabel?: string
  mcpServerName?: string
}

export type ToolResultEvent = {
  type: 'tool_result'
  id: string
  toolUseId: string
  timestamp: string
  status: 'ok' | 'error' | 'partial'
  text?: string
  json?: unknown
  artifactId?: string
  mcpMeta?: unknown
}

export type HookEvent = {
  type: 'hook'
  id: string
  timestamp: string
  hookEvent: 'pre_tool_use' | 'post_tool_use' | 'stop'
  toolUseId?: string
  label?: string
  text?: string
  success?: boolean
  durationMs?: number
  preventedContinuation?: boolean
}

export type SystemNoticeEvent = {
  type: 'system_notice'
  id: string
  timestamp: string
  subtype: string
  level?: 'info' | 'warning' | 'error'
  text: string
  data?: unknown
  commandInvocation?: CommandInvocation
}

export type CompactBoundaryEvent = {
  type: 'compact_boundary'
  id: string
  timestamp?: string
  text: string
}

export type SubagentRefEvent = {
  type: 'subagent_ref'
  id: string
  timestamp?: string
  agentId: string
  label?: string
}

export type UnknownEvent = {
  type: 'unknown'
  id: string
  timestamp?: string
  originalType?: string
  data: unknown
}

export type CanonicalEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | HookEvent
  | SystemNoticeEvent
  | CompactBoundaryEvent
  | SubagentRefEvent
  | UnknownEvent
