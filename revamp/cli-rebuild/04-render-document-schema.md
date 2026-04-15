# Render Document Schema

The render document is the frontend-facing shape derived from a canonical session.

It should be optimized for readability and deterministic UI behavior.

It is not the source of truth. It is the fast, UI-ready view of the canonical session.

## Why We Need A Separate Render Layer

The canonical session preserves meaning.

The render document preserves presentation intent.

That split gives us these benefits:

- the parser can remain stable while the UI improves
- the public page can load quickly without re-running parser logic
- grouping and callout decisions stay deterministic and cacheable

## Top-Level Shape

```ts
type RenderDocument = {
  kind: 'render_document'
  schemaVersion: 1
  session: {
    sessionId: string
    title: string
    provider: string
    createdAt: string
    updatedAt: string
    gitBranch?: string
    tag?: string
    stats: {
      messageCount: number
      toolRunCount: number
      activityGroupCount: number
    }
  }
  context?: {
    currentPlan?: {
      title: string
      body: string
      source: 'file' | 'transcript_recovered'
      filePath?: string
      artifactId?: string
    }
  }
  blocks: RenderBlock[]
}
```

## Render Blocks

```ts
type RenderBlock =
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
```

### Message Block

```ts
type MessageBlock = {
  type: 'message'
  id: string
  role: 'user' | 'assistant'
  text: string
}
```

### Question Block

```ts
type QuestionBlock = {
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
```

### Activity Group Block

```ts
type ActivityGroupBlock = {
  type: 'activity_group'
  id: string
  label: string
  defaultCollapsed: boolean
  summary?: string
  items: RenderActivity[]
}
```

```ts
type RenderActivity =
  | ToolRunActivity
  | HookActivity
```

```ts
type ToolRunActivity = {
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
```

```ts
type HookActivity = {
  type: 'hook_event'
  id: string
  title: string
  body?: string
  tone: 'info' | 'warning' | 'error'
}
```

### Callout Block

```ts
type CalloutBlock = {
  type: 'callout'
  id: string
  tone: 'info' | 'warning' | 'error'
  title: string
  body?: string
}
```

### Todo Block

```ts
type TodoBlock = {
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
```

### Task Timeline Block

```ts
type TaskTimelineBlock = {
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
```

### Resource Block

```ts
type ResourceBlock = {
  type: 'resource'
  id: string
  title: string
  server?: string
  uri?: string
  previewText?: string
  assetId?: string
  defaultCollapsed: boolean
}
```

### Structured Data Block

```ts
type StructuredDataBlock = {
  type: 'structured_data'
  id: string
  title: string
  data: unknown
  defaultCollapsed: boolean
}
```

### Brief Delivery Block

```ts
type BriefDeliveryBlock = {
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
```

### Subagent Thread Block

```ts
type SubagentThreadBlock = {
  type: 'subagent_thread'
  id: string
  title: string
  defaultCollapsed: boolean
  blocks: RenderBlock[]
}
```

## Deterministic Grouping Rules

The render builder should decide grouping from structured events, not from generated prose.

Examples:

- consecutive Bash calls -> `Ran 4 commands`
- grouped Read/Grep/Glob -> `Explored code`
- mixed reads and searches -> `Read 3 files, searched 2 patterns`
- stop hook summaries -> warning callout
- MCP tool runs -> `Called MCP: <server>/<tool>`

If a session-level plan is present, the render builder should expose it in `context.currentPlan` so the frontend can show it as an expandable context panel above the main transcript.

For `AskUserQuestion`, the render builder should emit a dedicated `question` block instead of burying the interaction inside a generic activity group.

Todo snapshots, task timelines, MCP resources, structured outputs, and brief deliveries can also be rendered through dedicated artifact-driven blocks when the canonical session provides them.

## Artifact Expansion

Large command output should not always render inline.

The render document should contain:

- short preview text
- artifact reference
- enough metadata for the frontend to lazy-load the full body later

## Example Flow

```text
User prompt
Assistant explanation
Activity group: Ran 4 commands
Callout: Stop hook feedback
Assistant summary
Subagent thread
```

That is the presentation style the new HowiCC UI should be built around.
