# Claude Code Understanding

This folder captures the parts of Claude Code we needed to understand before redesigning HowiCC.

The goal is not to reimplement Claude Code. The goal is to understand its persistence model well enough that HowiCC can import sessions faithfully and produce a clean, deterministic representation for sharing.

## Key Conclusions

- Claude Code stores sessions on the filesystem, not in a database.
- The real transcript is the per-session `.jsonl` file under `~/.claude/projects/...`.
- The transcript is append-only and may rely on sibling sidecars such as `tool-results/` and `subagents/`.
- Resume and preview do not trust file order alone. Claude Code rebuilds a conversation chain from message graph relationships and performs recovery passes for orphaned parallel tool results.
- The UI is driven by normalized and regrouped messages, not by raw transcript lines.

## Claude Code Source Areas We Investigated

These references come from the Claude Code source snapshot we reviewed locally.

### Persistence and Paths

- `src/utils/envUtils.ts`
  - `getClaudeConfigHomeDir()`
- `src/utils/sessionStoragePortable.ts`
  - `sanitizePath()`
  - `loadSessionFileById()`
- `src/utils/sessionStorage.ts`
  - `getTranscriptPath()`
  - `materializeSessionFile()`
  - `appendEntry()`
  - `loadTranscriptFile()`
  - `buildConversationChain()`

### Resume, Recovery, and Message Ordering

- `src/utils/conversationRecovery.ts`
  - `loadConversationForResume()`
- `src/utils/messages.ts`
  - `normalizeMessages()`
  - `reorderMessagesInUI()`
- `src/utils/groupToolUses.ts`
  - `applyGrouping()`
- `src/utils/collapseHookSummaries.ts`
  - `collapseHookSummaries()`

### Session List / Resume Picker

- `src/components/LogSelector.tsx`
- `src/components/SessionPreview.tsx`
- `src/commands/resume/resume.tsx`
- `src/utils/sessionStorage.ts`
  - `readLiteMetadata()`
  - `loadSameRepoMessageLogs()`
  - `loadAllProjectsMessageLogs()`

### Persisted Tool Outputs

- `src/utils/toolResultStorage.ts`

## Principles We Should Carry Into HowiCC

1. Preserve the raw disk snapshot before interpreting it.
2. Build a canonical imported shape before building UI blocks.
3. Avoid lossy conversions during ingest.
4. Treat sidecars as first-class source data.
5. Keep parser logic deterministic and testable.

## Document Map

- `01-filesystem-and-storage.md`
- `02-transcript-lifecycle.md`
- `03-resume-and-recovery.md`
- `04-parser-implications.md`
- `05-plan-mode-and-plan-files.md`
- `06-ask-user-question-and-tool-rejections.md`
- `07-durable-artifacts-beyond-tool-runs.md`
