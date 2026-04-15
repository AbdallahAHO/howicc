# Plan Mode And Plan Files

Yes, this is possible.

Claude Code plan mode is backed by a real markdown file, and Claude Code also persists enough plan-related metadata into the session transcript that HowiCC can often recover the plan even if the file is no longer present.

This is important because it means the plan can become a first-class part of the imported conversation context rather than a UI-only transient detail.

## Short Answer

How Claude Code treats plans:

- plan mode writes to a markdown file
- the file path is deterministic once the session's plan slug is known
- the slug is stamped into transcript messages
- the plan content can also appear in multiple transcript-derived fallback forms

That gives HowiCC a strong import strategy:

```text
resolve actual plan file
-> if missing, recover plan from transcript evidence
-> store as a plan artifact in the source bundle
-> reference it from the canonical session
-> expose it in the UI as session context
```

## Where Claude Code Stores Plan Files

Claude Code uses `src/utils/plans.ts` for plan file handling.

Important functions:

- `getPlanSlug()`
- `getPlansDirectory()`
- `getPlanFilePath(agentId?)`
- `getPlan()`
- `copyPlanForResume()`
- `persistFileSnapshotIfRemote()`

### Default Location

By default, plan files live under:

```text
~/.claude/plans/
```

Main session plan filename:

```text
<plan-slug>.md
```

Subagent plan filename:

```text
<plan-slug>-agent-<agentId>.md
```

### Custom Location

Claude Code also supports a custom `plansDirectory` setting.

From `src/utils/settings/types.ts`:

- `plansDirectory`: custom directory for plan files, relative to project root

From `src/utils/plans.ts`:

- if `plansDirectory` is set, it is resolved relative to the project cwd
- otherwise it falls back to `~/.claude/plans`

That means HowiCC bundling must not assume that plan files always live under `~/.claude/plans`.

## How Claude Code Links The Plan File To A Session

Claude Code persists a plan slug into transcript messages.

In `src/utils/sessionStorage.ts`, session writes stamp:

- `slug`

onto serialized transcript messages.

That slug is specifically noted as being used for plan files and similar session-linked artifacts.

So the local importer can do this:

```text
read transcript
-> find persisted slug
-> resolve plan directory
-> compute plan file path
-> read plan markdown file if present
```

## How Plan Content Is Preserved Beyond The File Itself

Claude Code has multiple fallback mechanisms that preserve plan content in or near the transcript.

This is what makes plan import reliable.

### 1. ExitPlanMode Tool Input Injection

In `src/utils/api.ts`, `normalizeToolInput()` injects:

- `plan`
- `planFilePath`

into `ExitPlanMode` tool input so hooks and SDK consumers can see the plan.

In `src/utils/messages/mappers.ts`, assistant messages are also normalized so `ExitPlanMode` tool-use blocks can include the plan content.

This means the approved plan can be embedded in assistant `tool_use` content.

### 2. ExitPlanMode Tool Result Echo

In `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`, successful plan exit returns a `tool_result` that includes:

```text
## Approved Plan:
<plan text>
```

or:

```text
## Approved Plan (edited by user):
<plan text>
```

This is a strong transcript-level fallback because it means the approved plan is echoed back into tool result content.

### 3. `plan_file_reference` Attachment During Compaction

In `src/services/compact/compact.ts`, Claude Code can create a `plan_file_reference` attachment containing:

- `planFilePath`
- `planContent`

And in `src/utils/messages.ts`, that attachment is converted into reminder context for future model turns.

This matters because the plan can survive compaction boundaries.

### 4. `file_snapshot` System Messages In Remote Environments

In `src/utils/plans.ts`, `persistFileSnapshotIfRemote()` can snapshot the current plan file into a system `file_snapshot` message.

That snapshot stores:

- `key: 'plan'`
- `path`
- `content`

This is used especially in remote environments where local files might not persist reliably.

### 5. `planContent` On User Messages

Claude Code also carries plan content in certain user-message flows, especially around context clearing and continuing from an approved plan.

Relevant areas:

- `src/screens/REPL.tsx`
- `src/utils/plans.ts`
- `src/components/messages/UserTextMessage.tsx`

This gives us another transcript-derived recovery path.

## Claude Code's Own Recovery Strategy

Claude Code itself already has a recovery helper in `src/utils/plans.ts`.

`recoverPlanFromMessages()` scans message history in this rough order:

1. `ExitPlanMode` tool-use input with injected `plan`
2. `user.planContent`
3. `attachment.type === 'plan_file_reference'`

And `copyPlanForResume()` first tries the plan file directly, then a `file_snapshot`, then message-history recovery.

That is strong evidence that HowiCC should support the same concept.

## Bundling Recommendation For HowiCC

HowiCC should treat plan data as part of the source bundle even though the plan file may live outside the transcript folder.

Recommended import order:

### First Choice: Actual Plan File

1. parse transcript and recover session slug
2. resolve plans directory from Claude Code settings
3. read `<slug>.md`
4. read any subagent plan files that match `<slug>-agent-<agentId>.md`

### Fallback Choice: Transcript Recovery

If the file is missing, recover from:

1. latest `file_snapshot` with `key === 'plan'`
2. latest `plan_file_reference` attachment
3. latest `ExitPlanMode` tool-use input that includes `plan`
4. latest `ExitPlanMode` tool-result marker `## Approved Plan:`
5. latest `user.planContent`

### Bundle Representation

HowiCC should include plan data in the source bundle manifest with a distinct kind:

```ts
type SourceFileKind =
  | 'transcript'
  | 'tool_result'
  | 'subagent_transcript'
  | 'subagent_meta'
  | 'remote_agent_meta'
  | 'plan_file'
  | 'recovered_plan'
```

## Canonical Session Recommendation

The canonical session should keep plan context explicitly instead of burying it in generic artifacts only.

Recommended shape:

```ts
type SessionPlan = {
  id: string
  role: 'main' | 'subagent'
  source: 'file' | 'file_snapshot' | 'attachment' | 'tool_use' | 'tool_result' | 'user_message'
  filePath?: string
  agentId?: string
  content: string
  slug?: string
}
```

Why this is useful:

- the frontend can show the active plan clearly
- the import remains honest about where the plan came from
- we can later support plan history or plan diffs if needed

## UI Recommendation

For the public conversation page, the plan should be shown as session context, not just another raw message.

Good options:

- expandable `Plan` panel near the top of the page
- sticky context sidebar on desktop
- inline callout before implementation messages begin

For V1, the simplest reliable choice is:

- show the latest resolved main-session plan as an expandable panel
- show subagent plans inside each subagent thread when present

## Best V1 Rule

Do not try to compute a synthetic merged plan history yet.

Instead:

- resolve the latest trustworthy plan content
- preserve the source of that plan
- attach it to the imported revision

Because HowiCC is revisioned, later syncs can naturally capture updated plans as new revisions.

That gives us reliability first, and plan-history features later.
