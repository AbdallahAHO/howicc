# Session Artifact Union

This document upgrades the canonical model from a vague `artifacts: ArtifactRef[]` field into a more deliberate shape.

The key distinction is:

- `events` describe what happened in the transcript
- `assets` describe stored binary or text payloads
- `artifacts` describe higher-level semantic units extracted from events and assets

That separation is essential if we want the system to stay clean as we add more providers.

## The Core Model

The canonical session should be composed from three layers:

```text
canonical session
├── events    -> raw normalized timeline facts
├── assets    -> persisted payload references and bundle-linked files
└── artifacts -> extracted semantic units for UI and search
```

## Why `ArtifactRef[]` Is Not Enough

The earlier `ArtifactRef` concept only covered file-like references.

That is not enough for artifacts such as:

- a plan
- a questionnaire
- a todo snapshot
- a tool rejection decision
- a task-status timeline

Those are semantic entities, not just payload references.

## Recommended Canonical Shape

```ts
type CanonicalSession = {
  kind: 'canonical_session'
  schemaVersion: 1
  parserVersion: string
  provider: ProviderId
  source: CanonicalSource
  metadata: CanonicalMetadata
  selection: CanonicalSelection
  stats: CanonicalStats
  events: CanonicalEvent[]
  agents: AgentThread[]
  assets: AssetRef[]
  artifacts: SessionArtifact[]
  searchText: string
  providerData?: Record<string, unknown>
}
```

## Assets Versus Artifacts

### `AssetRef`

Assets are file-like or blob-like payloads.

Examples:

- persisted Bash output
- imported plan markdown file
- recovered plan file snapshot body
- uploaded brief attachment
- MCP blob saved to disk

Suggested shape:

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

### `SessionArtifact`

Artifacts are semantic, user-meaningful structures derived from events and assets.

Examples:

- the active plan
- the AskUserQuestion interaction
- a tool rejection decision
- the current todo list snapshot

## Common Artifact Base

All artifacts should carry provenance.

```ts
type ArtifactSourceRef = {
  eventIds?: string[]
  toolUseIds?: string[]
  assetIds?: string[]
  agentId?: string
}

type ArtifactBase = {
  id: string
  artifactType: string
  provider: ProviderId
  source: ArtifactSourceRef
  createdAt?: string
  updatedAt?: string
  providerData?: Record<string, unknown>
}
```

This is important because we should always be able to answer:

- where did this artifact come from
- which event IDs produced it
- which tool use was involved
- which asset file it depends on

## Recommended `SessionArtifact` Union

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

## Artifact Definitions

### PlanArtifact

```ts
type PlanArtifact = ArtifactBase & {
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
```

### QuestionArtifact

```ts
type QuestionArtifact = ArtifactBase & {
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
  annotations?: Record<string, {
    preview?: string
    notes?: string
  }>
  feedbackText?: string
}
```

### ToolDecisionArtifact

```ts
type ToolDecisionArtifact = ArtifactBase & {
  artifactType: 'tool_decision'
  toolName: string
  status: 'rejected' | 'redirected' | 'aborted' | 'hook_blocked' | 'interrupted'
  feedbackText?: string
  isErrorResult: boolean
}
```

### ToolOutputArtifact

```ts
type ToolOutputArtifact = ArtifactBase & {
  artifactType: 'tool_output'
  toolName: string
  status: 'ok' | 'error' | 'partial'
  previewText?: string
  fullOutputAssetId?: string
}
```

### TodoSnapshotArtifact

```ts
type TodoSnapshotArtifact = ArtifactBase & {
  artifactType: 'todo_snapshot'
  todos: Array<{
    content: string
    status: string
    activeForm?: string
    priority?: string
  }>
}
```

### TaskStatusTimelineArtifact

```ts
type TaskStatusTimelineArtifact = ArtifactBase & {
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
```

### McpResourceArtifact

```ts
type McpResourceArtifact = ArtifactBase & {
  artifactType: 'mcp_resource'
  server: string
  uri: string
  name: string
  description?: string
  textAssetId?: string
  blobAssetId?: string
}
```

### StructuredOutputArtifact

```ts
type StructuredOutputArtifact = ArtifactBase & {
  artifactType: 'structured_output'
  data: unknown
}
```

### InvokedSkillSetArtifact

```ts
type InvokedSkillSetArtifact = ArtifactBase & {
  artifactType: 'invoked_skill_set'
  skills: Array<{
    name: string
    path: string
    contentAssetId?: string
    inlineContent?: string
  }>
}
```

### BriefDeliveryArtifact

```ts
type BriefDeliveryArtifact = ArtifactBase & {
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
```

## Canonical Rules

1. `events` must be enough to re-derive `artifacts`.
2. `assets` must be enough to lazy-load heavy payloads.
3. `artifacts` must be enough to build the public UI without reparsing raw events.
4. Any artifact that cannot be trusted should still preserve provenance and confidence via `providerData` or a future `confidence` field.

## Why This Is The Right Split

This gives us:

- deterministic re-rendering
- simpler public rendering
- better search and summaries
- a clean path for non-Claude providers
- fewer parser rewrites when the UI evolves
