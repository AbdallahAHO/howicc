# Canonical To Render Mapping

This document explains how the canonical session should be converted into the final render document.

The canonical session is for truth.

The render document is for clarity.

The render builder should be deterministic and should not need provider-specific disk knowledge.

## Mapping Layers

```text
source bundle
-> canonical events + assets + artifacts
-> render builder
-> render document
```

## What The Render Builder Reads

The render builder should read:

- `metadata`
- `events`
- `agents`
- `artifacts`
- `assets` when previews or references are needed

It should not read raw provider files directly.

## Mapping Strategy

### 1. Session Context

Use canonical session metadata and artifacts to build top-of-page context.

Examples:

- title
- provider
- branch
- tag
- latest main-session plan
- summary stats

This belongs in `renderDocument.session` and `renderDocument.context`.

### 2. Main Timeline

Use canonical events for the primary chronological transcript.

Examples:

- user prose messages
- assistant prose messages
- activity groups derived from tool calls and hook events
- system callouts

### 3. Artifact Blocks

Use extracted artifacts to insert higher-level blocks where they improve readability.

Examples:

- question block
- todo snapshot block
- task timeline block
- resource block
- brief delivery block

### 4. Subagent Threads

Use `agents` plus related artifacts to render nested threads or side panels.

## Recommended Render Block Expansion

The render block union can grow beyond the initial shape.

Recommended direction:

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

## Canonical Artifact To Render Mapping

## `plan`

Canonical artifact:

- `PlanArtifact`

Render destination:

- `renderDocument.context.currentPlan`

Why:

- plans are session context more than timeline content

## `question_interaction`

Canonical artifact:

- `QuestionArtifact`

Render destination:

- `QuestionBlock`

Why:

- questions are a user-decision interaction, not generic tool noise

## `tool_decision`

Canonical artifact:

- `ToolDecisionArtifact`

Render destination:

- `CalloutBlock`
- or inline annotation inside the related activity group

Why:

- rejected or redirected tools often explain a change in workflow

## `tool_output`

Canonical artifact:

- `ToolOutputArtifact`

Render destination:

- `ActivityGroupBlock.items[*].artifactId`
- or dedicated output drawer / modal

Why:

- output belongs with the related tool activity, but large bodies should stay collapsed

## `todo_snapshot`

Canonical artifact:

- `TodoSnapshotArtifact`

Render destination:

- `TodoBlock`

Why:

- todo state is a compact progress summary and deserves dedicated rendering

## `task_status_timeline`

Canonical artifact:

- `TaskStatusTimelineArtifact`

Render destination:

- `TaskTimelineBlock`

Why:

- background task progress is easier to scan as a timeline than as repeated attachment rows

## `mcp_resource`

Canonical artifact:

- `McpResourceArtifact`

Render destination:

- `ResourceBlock`

Why:

- resources are external context objects, not just text output

## `structured_output`

Canonical artifact:

- `StructuredOutputArtifact`

Render destination:

- `StructuredDataBlock`

Why:

- some users will want a JSON/data viewer with collapse and copy actions

## `invoked_skill_set`

Canonical artifact:

- `InvokedSkillSetArtifact`

Render destination:

- provenance panel or collapsible context section

Why:

- useful context, but not primary transcript content for most readers

## `brief_delivery`

Canonical artifact:

- `BriefDeliveryArtifact`

Render destination:

- `BriefDeliveryBlock`

Why:

- this is explicitly user-directed communication and should be rendered as such

## Ordering Rules

Artifacts should not arbitrarily reorder the conversation.

Recommended rule:

- attach artifacts to the nearest relevant event span using `source.eventIds`
- if an artifact is session-level context, place it in `renderDocument.context`
- if an artifact belongs to a subagent, keep it inside that subagent thread

## V1 Render Scope

To keep the first implementation disciplined, I would recommend this initial render scope:

1. plan context panel
2. message blocks
3. question blocks
4. activity groups with expandable tool outputs
5. callout blocks
6. subagent threads

Then V1.5:

1. todo blocks
2. task timeline blocks

Then V2:

1. resource blocks
2. structured data blocks
3. brief delivery blocks
4. provenance panels for skills and memory context

## Render Builder Rule

The render builder should always prefer explicit artifacts over heuristics.

If a plan, question flow, or todo snapshot has already been extracted into a typed artifact, the UI should render from that artifact rather than trying to infer structure again from generic events.
