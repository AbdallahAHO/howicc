# Claude Code Resume And Recovery Logic

Claude Code does not rebuild a resumable conversation by trusting transcript line order alone.

That is one of the most important lessons for HowiCC.

## Resume Picker Flow

The resume picker does a cheap listing pass first.

```mermaid
flowchart LR
  A[/resume] --> B[load same-repo logs]
  B --> C[get stat-only session files]
  C --> D[read head and tail metadata]
  D --> E[build lightweight session list]
  E --> F[user selects session]
  F --> G[load full transcript]
  G --> H[recover latest branch]
```

Important functions:

- `loadSameRepoMessageLogs()`
- `getSessionFilesLite()`
- `readLiteMetadata()`
- `loadTranscriptFile()`

## Head/Tail Metadata Reads

For fast session lists, Claude Code reads only a small chunk from the beginning and end of transcript files instead of fully parsing every file on disk.

That quick pass extracts things like:

- first prompt preview
- branch/cwd clues
- title-ish metadata
- size and timestamps

HowiCC can use the same idea for `howicc list`, but only for previews. Full import still needs a full parse.

## Graph-Based Conversation Recovery

When Claude Code fully loads a session, it rebuilds a conversation chain from message relationships.

Core function:

- `buildConversationChain(messages, leafMessage)`

The session behaves like a graph because messages have:

- `uuid`
- `parentUuid`

So the resume path is roughly:

```text
load transcript
-> collect messages by uuid
-> find selected leaf
-> walk parentUuid back to root
-> reverse to root->leaf order
-> repair orphaned parallel tool results
```

## Parallel Tool Result Recovery

Claude Code has explicit recovery logic for orphaned parallel tool results.

Why this exists:

- one assistant API response can create multiple tool-use blocks
- each tool-use may get its own result message
- a simple parent-chain walk can drop sibling assistant blocks or tool results

Claude Code compensates for this with:

- `recoverOrphanedParallelToolResults()`

This is one of the strongest signals that HowiCC must parse semantically, not linearly.

## Message Normalization

Claude Code also normalizes raw messages before rendering.

Function:

- `normalizeMessages()`

What it does conceptually:

- splits multi-content messages into one-block units
- derives stable per-block UUIDs when needed
- makes downstream ordering and grouping simpler

This is critical because assistant messages may include multiple content blocks, not just plain text.

## UI Reordering Around Tool Uses

Claude Code explicitly reorders messages for UI rendering.

Function:

- `reorderMessagesInUI()`

The grouped order is effectively:

```text
tool_use
-> pre-tool hook attachments
-> tool_result
-> post-tool hook attachments
```

That is already close to what HowiCC should render as a single activity group.

## Grouping Repeated Tool Uses

Claude Code also groups repeated tool uses when the tool supports grouped rendering.

Function:

- `applyGrouping()`

This allows the UI to show one grouped activity instead of a noisy set of repeated per-tool rows.

That pattern is directly relevant to our future shared conversation UI.

## Hook Summary Collapsing

Function:

- `collapseHookSummaries()`

Claude Code collapses consecutive hook summaries with the same label, especially for parallel tool calls.

This is another useful pattern to copy into HowiCC's render builder.

## Implications For HowiCC

Our parser should have these phases:

1. raw transcript parse
2. branch selection
3. chain reconstruction
4. orphan recovery
5. per-block normalization
6. tool-call/result pairing
7. render grouping

If we skip those phases, the final shared transcript will be visually simpler but semantically wrong.
