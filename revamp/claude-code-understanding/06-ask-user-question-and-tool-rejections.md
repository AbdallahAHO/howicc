# AskUserQuestion And Tool Rejections

This document explains how Claude Code's `AskUserQuestion` tool works, how it appears in persisted transcript data, and how HowiCC should import both successful answers and rejection-style outcomes.

## Short Answer

Yes, we can recover this reliably.

For `AskUserQuestion`, the transcript preserves enough data to reconstruct:

- the exact questions Claude asked
- the options presented to the user
- the selected answers
- optional notes and previews
- whether the user declined, redirected, or answered

The key is that Claude Code stores the question set in the assistant tool-use input and stores the structured answer payload in the user tool-result metadata.

## Core Source Files

Main implementation:

- `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx`

Permission dialog and user interactions:

- `src/components/permissions/AskUserQuestionPermissionRequest/AskUserQuestionPermissionRequest.tsx`
- `src/hooks/toolPermission/handlers/interactiveHandler.ts`
- `src/hooks/toolPermission/PermissionContext.ts`

Tool execution and transcript result creation:

- `src/services/tools/toolExecution.ts`

Relevant live-session state:

- `src/utils/sessionState.ts`

Related UI cues:

- `src/components/tasks/RemoteSessionDetailDialog.tsx`

## What The Tool Input Looks Like

The tool input schema is defined in `AskUserQuestionTool.tsx`.

The assistant `tool_use` input contains:

```ts
type AskUserQuestionInput = {
  questions: Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description: string
      preview?: string
    }>
    multiSelect?: boolean
  }>
  answers?: Record<string, string>
  annotations?: Record<string, {
    preview?: string
    notes?: string
  }>
  metadata?: {
    source?: string
  }
}
```

Important details:

- there can be 1 to 4 questions
- each question has 2 to 4 options
- option previews are supported
- free-text notes are supported through annotations
- multi-select questions serialize as comma-separated answer strings

## How The User Answers Get Added

The important thing is that the assistant's original `tool_use` contains the questions, but the user's answers are injected later through the permission flow.

In `AskUserQuestionPermissionRequest.tsx`:

- when the user accepts, the permission UI builds `updatedInput`
- `updatedInput` includes `answers`
- it also includes `annotations` when notes or option previews are relevant

That updated input is passed to `toolUseConfirm.onAllow(...)`.

Then in `AskUserQuestionTool.call(...)`, the tool returns:

```ts
{
  questions,
  answers,
  annotations?
}
```

## What Gets Saved In The Transcript On Success

Successful tool execution goes through `toolExecution.ts`.

Claude Code creates a user message containing:

1. a normal `tool_result` block with human-readable text
2. a raw `toolUseResult` object on the user message itself

That second part is critical.

### Human-Readable Tool Result Block

From `AskUserQuestionTool.mapToolResultToToolResultBlockParam(...)`:

```text
User has answered your questions: "Question"="Answer" ...
```

This is what the model sees in the conversation content.

### Structured Output Preservation

From `toolExecution.ts`:

- `createUserMessage({ toolUseResult: toolUseResult, ... })`

So the transcript-level user message also carries the raw structured result object.

For `AskUserQuestion`, that means the persisted message can retain:

- `questions`
- `answers`
- `annotations`

This is exactly what HowiCC should use for accurate artifact extraction.

## How To Reconstruct The Question Artifact

The most reliable reconstruction path is:

1. find assistant `tool_use` where `name === 'AskUserQuestion'`
2. read `block.input.questions`
3. find the paired user `tool_result` using `tool_use_id`
4. inspect the user message's `toolUseResult`
5. use `toolUseResult.questions`, `toolUseResult.answers`, and `toolUseResult.annotations` when present

This gives us a rich questionnaire artifact instead of a plain string summary.

## Recommended HowiCC Question Artifact Shape

```ts
type QuestionArtifact = {
  id: string
  toolUseId: string
  source: 'ask_user_question'
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
  outcome: 'answered' | 'declined' | 'redirected' | 'finished_plan_interview'
  rawText?: string
}
```

## What Happens On Rejection Or Redirect

`AskUserQuestion` is a `requiresUserInteraction()` tool.

That means the permission flow can deny or redirect the tool instead of returning a normal accepted output.

### Generic Rejection Path

In `interactiveHandler.ts`, a user rejection calls:

- `ctx.cancelAndAbort(feedback, undefined, contentBlocks)`

Then in `toolExecution.ts`, rejected permission decisions are converted into a user message whose content contains:

```ts
{
  type: 'tool_result',
  content: errorMessage,
  is_error: true,
  tool_use_id: toolUseID,
}
```

So a rejected tool use is persisted as a user `tool_result` with:

- `is_error: true`
- rejection text content

## AskUserQuestion-Specific Rejection Branches

The `AskUserQuestion` permission UI has multiple rejection-like outcomes.

### 1. User Declines To Answer

This goes through the standard reject path.

Important note:

- the pretty UI message `User declined to answer questions` comes from the tool renderer
- the persisted transcript will instead contain the generic rejected `tool_result` error content

So HowiCC should classify this from structure, not by expecting that exact display string in the transcript.

Good heuristic:

- `tool_use.name === 'AskUserQuestion'`
- paired `tool_result.is_error === true`
- no structured `toolUseResult.questions/answers`

### 2. "Respond To Claude"

The question dialog can let the user tell Claude they want to clarify instead of simply choosing one of the provided answers.

In `AskUserQuestionPermissionRequest.tsx`, this path calls:

- `toolUseConfirm.onReject(feedback, imageBlocks?)`

with feedback starting like:

```text
The user wants to clarify these questions.
```

This becomes a rejected `tool_result` with `is_error: true`, but it is semantically not a hard decline. It is a user redirect.

HowiCC should classify this separately as:

- `outcome: 'redirected'`

### 3. "Finish Plan Interview"

In plan interview flows, the user can signal that enough answers have been given.

That path also uses `onReject(feedback, ...)`, but the feedback starts like:

```text
The user has indicated they have provided enough answers for the plan interview.
```

This should be classified separately as:

- `outcome: 'finished_plan_interview'`

Again, it is stored as an error-style tool result, but semantically it is a controlled workflow branch, not a failure.

## Why This Matters For Our Importer

If we only look for successful tool results, we lose important conversation context.

For `AskUserQuestion`, the negative path still contains useful information:

- the question Claude asked
- the fact that the user declined or redirected
- any feedback text the user provided
- possible image attachments passed through the permission flow

That should be modeled as a structured interaction artifact, not just generic error text.

## Tool Rejection More Generally

This same rejection mechanism applies more broadly to other interactive tools.

Generic rule:

```text
assistant tool_use
-> permission UI allow or reject
-> if rejected, user tool_result with is_error=true
```

So HowiCC should support generic rejection metadata for all tools, not only `AskUserQuestion`.

Suggested generic classification fields:

- `toolName`
- `toolUseId`
- `status: 'ok' | 'error' | 'rejected' | 'redirected'`
- `feedbackText`
- `contentBlocks` or artifact refs when available

## Live Session Metadata Note

In `src/utils/sessionState.ts`, live `requires_action` state can include raw `input` so remote frontends can render pending questions without rescanning the event stream.

That is useful for live UIs, but HowiCC should still rely on transcript data for imported historical sessions.

## UI Recommendation For HowiCC

Do not render `AskUserQuestion` as a generic tool call row only.

Preferred UI:

- show the question text prominently
- show the option set in an expandable panel
- show the selected answer(s)
- show notes or preview snippets when present
- show whether the interaction was answered, declined, or redirected

This should make the shared transcript feel conversational and understandable, not like a low-level permission log.

## Best V1 Import Rule

For `AskUserQuestion`:

1. derive the question set from assistant `tool_use.input.questions`
2. derive selected answers from user `toolUseResult.answers` when present
3. derive notes and previews from `toolUseResult.annotations` when present
4. if the paired `tool_result` has `is_error: true`, classify the outcome:
   - generic decline
   - redirected to Claude
   - finished plan interview
5. store the result as a structured `QuestionArtifact`

That gives us a clean way to show user interactions in the final artifact view.
