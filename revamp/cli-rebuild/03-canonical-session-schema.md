# Canonical Session Schema

The canonical session is the durable, provider-aware, parser-normalized representation of one imported revision.

It is the primary source of truth for everything after ingest.

## Purpose

The canonical session should:

- preserve the meaning of the imported conversation
- normalize provider-specific quirks into a stable shape
- support multiple frontends and renderers
- remain useful even if the UI changes later
- stay extensible enough to support other agent tools later

## Top-Level Shape

```ts
type ProviderId = 'claude_code' | 'openai_codex' | 'custom'

type CanonicalSession = {
  kind: 'canonical_session'
  schemaVersion: 1
  parserVersion: string
  provider: ProviderId
  source: {
    sessionId: string
    projectKey: string
    projectPath?: string
    sourceRevisionHash: string
    transcriptSha256: string
    importedAt: string
  }
  metadata: {
    title?: string
    customTitle?: string
    summary?: string
    tag?: string
    cwd?: string
    gitBranch?: string
    createdAt: string
    updatedAt: string
    mode?: string
  }
  selection: {
    strategy: 'latest_leaf'
    selectedLeafUuid?: string
    branchCount: number
  }
  stats: {
    visibleMessageCount: number
    toolRunCount: number
    artifactCount: number
    subagentCount: number
  }
  events: CanonicalEvent[]
  agents: AgentThread[]
  assets: AssetRef[]
  artifacts: SessionArtifact[]
  searchText: string
  providerData?: Record<string, unknown>
}
```

## Canonical Events

The event list should preserve chronological meaning while staying renderer-neutral.

```ts
type CanonicalEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | HookEvent
  | SystemNoticeEvent
  | CompactBoundaryEvent
  | SubagentRefEvent
  | UnknownEvent
```

### User Message Event

```ts
type UserMessageEvent = {
  type: 'user_message'
  id: string
  uuid?: string
  parentUuid?: string
  timestamp: string
  text: string
  isMeta?: boolean
  origin?: string
}
```

### Assistant Message Event

```ts
type AssistantMessageEvent = {
  type: 'assistant_message'
  id: string
  uuid?: string
  parentUuid?: string
  timestamp: string
  text: string
  isMeta?: boolean
  isApiErrorMessage?: boolean
}
```

### Tool Call Event

```ts
type ToolCallEvent = {
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
```

For `AskUserQuestion`, the `input` should preserve the full `questions` array exactly enough to rebuild the questionnaire UI later.

### Tool Result Event

```ts
type ToolResultEvent = {
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
```

For `AskUserQuestion`, the raw result should preserve the structured tool output when available so the importer can recover:

- `questions`
- `answers`
- `annotations`

Rejection paths should still be represented via the paired `tool_result` event with `status: 'error' | 'partial'` and relevant text preserved.

### Hook Event

```ts
type HookEvent = {
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
```

### System Notice Event

```ts
type SystemNoticeEvent = {
  type: 'system_notice'
  id: string
  timestamp: string
  subtype: string
  level?: 'info' | 'warning' | 'error'
  text: string
  data?: unknown
}
```

### Unknown Event

```ts
type UnknownEvent = {
  type: 'unknown'
  id: string
  timestamp?: string
  originalType?: string
  data: unknown
}
```

## Agent Threads

Subagents should be represented as related threads, not flattened into the main event list.

```ts
type AgentThread = {
  agentId: string
  title?: string
  role: 'subagent' | 'remote_agent'
  events: CanonicalEvent[]
  metadata?: Record<string, unknown>
}
```

## Assets

Assets are file-like or blob-like payload references used by events and artifacts.

```ts
type AssetRef = {
  id: string
  kind:
    | 'source_file'
    | 'tool_output'
    | 'plan_file'
    | 'brief_attachment'
    | 'mcp_blob'
    | 'unknown'
  storage: 'bundle' | 'inline' | 'remote'
  relPath?: string
  mimeType?: string
  sha256?: string
  bytes?: number
  textPreview?: string
  providerData?: Record<string, unknown>
}
```

## Session Artifacts

Artifacts are semantic units derived from events and assets.

Recommended first-wave artifact union:

```ts
type SessionArtifact =
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
```

See `09-session-artifact-union.md` for the full artifact model.

For the first implementation, `provider` will usually be `'claude_code'`, but the schema should stay provider-neutral.

## Canonical Rules

1. Keep provider-specific details in `providerData` or event-level metadata.
2. Do not hide unknown event types.
3. Do not collapse to markdown.
4. Keep artifact references explicit.
5. Keep branch selection decisions explicit.

## Why This Shape Is Durable

This shape is stable enough for:

- UI rendering
- search indexing
- privacy inspection
- export formats
- re-rendering after UI changes
- future provider adapters
