# Parser Implications For HowiCC

This document turns the Claude Code research into import rules for HowiCC.

## What We Must Preserve

HowiCC should preserve these source facts from Claude Code:

- top-level transcript path
- sidecar files such as persisted tool results
- message graph identifiers (`uuid`, `parentUuid`)
- tool-use identifiers (`tool_use_id` and related grouping data)
- metadata such as title, branch, cwd, and tags
- subagent threads and remote task metadata

## What We Must Not Assume

We must not assume that Claude Code sessions are:

- one flat sequence of text messages
- fully recoverable from markdown
- fully recoverable from the transcript file alone
- safe to discover with recursive `**/*.jsonl`
- safe to dedupe by `sessionId` only

## Correct Import Model

The minimum reliable import model is:

```text
top-level session transcript
+ session sidecars
+ parser version
-> canonical session
-> render document
```

## Discovery Rules

### Correct

Discover only:

```text
~/.claude/projects/<project-key>/<session-id>.jsonl
```

### Incorrect

Do not recursively import every `.jsonl` under `~/.claude/projects` as a top-level conversation.

That would incorrectly import:

- subagent transcripts
- nested helper data

## Branch Rules

HowiCC should explicitly choose a selected branch for display.

Recommended default:

- latest resumable non-sidechain leaf

But the canonical import should still preserve enough data to support alternate branch inspection later if we want it.

## Sidecar Rules

If a tool result has been persisted into `tool-results/`, we should:

1. keep the artifact reference in the canonical session
2. load the persisted body into the source bundle
3. expose a preview in the render document
4. lazy-load the full body in the final UI if the output is large

## Render Rules

The future UI should be built from a derived block model, not from raw messages.

Examples of deterministic render blocks:

- user prose block
- assistant prose block
- activity group such as `Ran 4 commands`
- hook callout such as `Stop hook feedback`
- subagent thread block

## Privacy Rules

Claude Code transcripts can contain:

- filesystem paths
- shell output
- secrets in command output
- hook output
- generated files and diffs

So HowiCC should run privacy checks against:

- prose text
- tool inputs
- tool outputs
- sidecar artifact contents

Privacy cannot be limited to user and assistant text alone.

## Long-Term Schema Rule

The canonical session should describe imported conversations in a provider-neutral way.

Claude Code-specific details should be captured in adapter metadata, but the main shape should be usable later for:

- OpenAI Codex
- other folder-backed agent tools
- future local-first assistants
