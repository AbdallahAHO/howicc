# Discovery And Bundling

This document defines how the CLI should discover Claude Code sessions and package them into a reliable source bundle.

## Discovery Rule For Claude Code

Only treat this pattern as a top-level session:

```text
~/.claude/projects/<project-key>/<session-id>.jsonl
```

Do not recursively import every `.jsonl` file under `~/.claude/projects/` as a top-level conversation.

## Why Recursive Discovery Is Wrong

Recursive discovery will incorrectly include:

- `subagents/*.jsonl`
- nested session support files
- other internal JSONL sidecars that are not user-facing top-level sessions

## Discovery Output

The discovery phase should return a lightweight descriptor:

```ts
type DiscoveredSession = {
  provider: 'claude_code'
  sessionId: string
  projectKey: string
  projectPath?: string
  transcriptPath: string
  createdAt?: string
  updatedAt: string
  sizeBytes: number
  firstPromptPreview?: string
}
```

This is a listing shape, not a canonical import shape.

## Source Bundle

The source bundle is the immutable import package for one revision.

```ts
type SourceBundle = {
  kind: 'agent_source_bundle'
  version: 1
  provider: 'claude_code'
  sessionId: string
  projectKey: string
  projectPath?: string
  capturedAt: string
  files: SourceFile[]
  manifest: SourceManifest
}
```

```ts
type SourceFile = {
  relPath: string
  kind:
    | 'transcript'
    | 'tool_result'
    | 'plan_file'
    | 'recovered_plan'
    | 'subagent_transcript'
    | 'subagent_meta'
    | 'remote_agent_meta'
  sha256: string
  bytes: number
}
```

## Claude Code Bundle Rules

For Claude Code, the bundle should include:

- the top-level transcript `.jsonl`
- zero or more `tool-results/*`
- zero or more plan files resolved from the session slug and plans directory
- zero or more `subagents/*.jsonl`
- zero or more `subagents/*.meta.json`
- zero or more `remote-agents/*.meta.json`

Plan files are special because they may live outside the `projects/` tree.

By default they live under:

```text
~/.claude/plans/
```

But Claude Code also supports a custom `plansDirectory` setting relative to project root. The Claude Code adapter should resolve that setting before deciding where to look.

## Revision Identity

Revision identity must not be just `sessionId`.

It should be based on the actual source contents.

Recommended identity:

```text
sourceRevisionHash = sha256(
  transcript bytes
  + sidecar file hashes
  + selected import manifest version
)
```

That means a growing Claude Code session will naturally produce a new revision even when the session id stays the same.

## Bundle Preservation Rule

The CLI should preserve the source bundle before canonical parsing or redaction.

That gives us:

- reproducibility
- debuggability
- import traceability
- the ability to reparse later when the parser improves

That rule also applies to plan files: if the plan is available locally, bundle it as a source artifact rather than depending only on transcript recovery.

## Local Export Formats

Useful CLI outputs:

- raw folder copy
- tarball or zip bundle
- manifest JSON

We do not need to decide the archive format immediately as long as the file manifest is stable and versioned.
