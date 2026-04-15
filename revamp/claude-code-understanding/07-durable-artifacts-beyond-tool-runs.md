# Durable Artifacts Beyond Tool Runs

Claude Code persists more than plain user/assistant messages and more than generic tool calls.

This document inventories the durable structured data we can extract in a stronger way for HowiCC.

The main idea is:

```text
raw transcript parse
-> typed artifact extraction
-> canonical session
-> render document
```

Not every useful thing should remain a generic `tool_call` + `tool_result` pair in the final UI.

## Why This Matters

Claude Code already distinguishes a lot of structured state in its own source:

- plan files
- question flows
- todo state
- skills restored across compaction
- MCP resources
- background task state
- structured tool outputs
- hook stop and permission outcomes

HowiCC should take advantage of that structure instead of flattening everything to prose or generic tool rows.

## Recommended Artifact Tiers

### Tier 1: Highest Value, Strongest Fidelity

These should become first-class HowiCC artifacts early.

1. plans
2. AskUserQuestion interactions
3. tool rejections and redirects
4. persisted large tool outputs
5. todo state
6. subagent/background task status

### Tier 2: Strong Structured Context

These are good follow-up artifact families.

1. MCP resources
2. structured outputs
3. invoked skills
4. Brief / SendUserMessage deliveries

### Tier 3: Secondary Session Context

Useful, but lower priority for public rendering.

1. relevant memories and current session memory
2. IDE selection and opened file attachments
3. plan mode and auto mode reminders
4. token and budget usage attachments

## Artifact Family Inventory

## 1. Plans

Already documented separately in `05-plan-mode-and-plan-files.md`.

Why it matters:

- the plan often explains the arc of the session better than the raw message stream
- the plan can exist as a file and as transcript recovery data

Recommended HowiCC artifact:

- `plan`

## 2. AskUserQuestion Interactions

Already documented separately in `06-ask-user-question-and-tool-rejections.md`.

Why it matters:

- questions are not just another tool invocation
- they capture requirement gathering, decision points, and user preferences

Recommended HowiCC artifact:

- `question_interaction`

## 3. Tool Rejections And Redirects

Claude Code stores permission-denied tool outcomes as user `tool_result` blocks with `is_error: true`.

Important source areas:

- `src/hooks/toolPermission/PermissionContext.ts`
- `src/hooks/toolPermission/handlers/interactiveHandler.ts`
- `src/services/tools/toolExecution.ts`

Why it matters:

- not all `is_error` results are ordinary failures
- some are user decisions
- some are workflow redirects
- they help explain why the conversation changed direction

Recommended HowiCC artifact:

- `tool_decision`

With subtypes such as:

- `rejected`
- `redirected`
- `aborted`
- `hook_blocked`

## 4. Persisted Large Tool Outputs

Claude Code can spill large tool output into external storage and preserve replacement metadata in the transcript.

Key area:

- `src/utils/toolResultStorage.ts`

Why it matters:

- this is often the real Bash, MCP, or search output the user wants to inspect
- the transcript may only contain a compact preview or replacement record

Recommended HowiCC artifact:

- `tool_output_artifact`

This should support:

- preview text
- lazy-loaded full body
- artifact metadata such as bytes and mime type when known

## 5. Todo State

Claude Code's `TodoWrite` tool is more structured than a normal text update.

Relevant source areas:

- `src/tools/TodoWriteTool/TodoWriteTool.ts`
- `src/utils/sessionRestore.ts`
- `src/utils/attachments.ts` (`todo_reminder`)

What is durable:

- the latest todo list can be reconstructed from the last `TodoWrite` assistant tool-use input
- successful tool output contains `oldTodos` and `newTodos` in structured result form
- reminder attachments can also surface todo context later in the session

Why it matters:

- todo evolution gives a clean high-level progress trace
- it is often a better summary of work than the raw prose stream

Recommended HowiCC artifact:

- `todo_snapshot`

Potential V2 extension:

- derive `todo_transitions` across revisions or within a session

## 6. Background Task And Subagent Status

Claude Code emits `task_status` attachments for background work.

Relevant source areas:

- `src/utils/task/framework.ts`
- `src/utils/attachments.ts`
- `src/components/messages/AttachmentMessage.tsx`

What is durable:

- task id
- task type
- status
- description
- delta summary
- sometimes output file path

Why it matters:

- sessions with multiple tasks or subagents are easier to understand when background execution is explicit

Recommended HowiCC artifact:

- `task_status_timeline`

## 7. MCP Resources

Claude Code has dedicated MCP resource handling that creates structured attachments.

Relevant source areas:

- `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts`
- `src/utils/attachments.ts`
- `src/components/messages/AttachmentMessage.tsx`

What is durable:

- server name
- resource URI
- resource name
- optional description
- text content or saved blob path

Why it matters:

- MCP resources are often important external context
- they are more meaningful as a resource artifact than as generic JSON blobs

Recommended HowiCC artifact:

- `mcp_resource`

## 8. Structured Output

Claude Code can store `structured_output` attachments when a tool produces separate machine-readable data.

Relevant source areas:

- `src/services/tools/toolExecution.ts`
- `src/utils/attachments.ts`
- `src/utils/messages.ts`

Why it matters:

- not every useful output should be stringified back into markdown or plain text
- some outputs deserve a JSON viewer or typed card renderer later

Recommended HowiCC artifact:

- `structured_output`

## 9. Invoked Skills

Claude Code creates `invoked_skills` attachments during compaction to preserve active skill guidance.

Relevant source areas:

- `src/services/compact/compact.ts`
- `src/utils/conversationRecovery.ts`
- `src/utils/attachments.ts`

What is durable:

- skill name
- path
- captured skill content

Why it matters:

- this explains why the model followed certain rules or workflows later in the session
- it is valuable as provenance and debugging context

Recommended HowiCC artifact:

- `invoked_skill_set`

## 10. Brief / SendUserMessage Deliveries

Claude Code has a `BriefTool` / `SendUserMessage` path that can carry message content and attachment metadata, including uploaded `file_uuid` values for web viewers.

Relevant source areas:

- `src/tools/BriefTool/BriefTool.ts`
- `src/tools/BriefTool/upload.ts`

Why it matters:

- this is a user-facing communication primitive, not just an internal tool run
- it may include explicit attachments meant for user consumption

Recommended HowiCC artifact:

- `brief_delivery`

## Lower-Priority Structured Context

These may still be worth preserving in canonical form, but they are lower priority for first-wave public rendering.

Examples:

- `relevant_memories`
- `current_session_memory`
- `selected_lines_in_ide`
- `opened_file_in_ide`
- `command_permissions`
- `token_usage`
- `budget_usd`
- `output_token_usage`

These can remain typed attachment-derived events first, then graduate into first-class artifacts if the UI needs them later.

## Suggested First-Wave Artifact Set For HowiCC

If we want a strong but realistic first implementation, I would prioritize these artifact extractors:

1. `extractPlanArtifacts`
2. `extractQuestionArtifacts`
3. `extractToolDecisionArtifacts`
4. `extractToolOutputArtifacts`
5. `extractTodoArtifacts`
6. `extractTaskStatusArtifacts`

Then second wave:

1. `extractMcpResourceArtifacts`
2. `extractStructuredOutputArtifacts`
3. `extractInvokedSkillArtifacts`
4. `extractBriefArtifacts`

## Public UI Guidance

Not every artifact should render the same way.

Recommended treatment:

- plans -> top context panel
- questions -> dedicated interaction cards
- tool decisions -> callouts or inline decision rows
- todos -> progress panel or timeline
- task status -> background work timeline
- MCP resources -> resource cards
- structured output -> expandable JSON viewer
- invoked skills -> provenance/debug panel
- brief deliveries -> user-communication card

That keeps the conversation readable while still exposing the rich structure Claude Code already preserves.
