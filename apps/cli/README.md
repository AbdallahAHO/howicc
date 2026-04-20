# howicc

The current HowiCC command-line app for local coding-agent workflows.

It is aligned with the revamp architecture:

- `@howicc/api-client`
- `@howicc/provider-claude-code`
- `@howicc/render`
- the typed upload and CLI-auth contracts

## What It Does

The new CLI is designed around the real lifecycle of local sessions:

- discover Claude Code sessions on disk
- inspect the canonical and rendered outputs
- sync sessions through the typed upload pipeline
- remember local sync state so repeat runs stay fast and predictable
- authenticate through the browser flow used by the web app

## Quick Start

```bash
pnpm --filter howicc exec tsx src/index.ts login
pnpm --filter howicc exec tsx src/index.ts list --unsynced
pnpm --filter howicc exec tsx src/index.ts sync
pnpm --filter howicc exec tsx src/index.ts profile
```

Published CLI usage is the same without the `pnpm ... tsx src/index.ts` prefix:

```bash
howicc login
howicc list --unsynced
howicc sync
howicc profile
```

## Command Surface

### `howicc config`

Configure the API and web origins used by the CLI.

- stores local defaults for the CLI
- validates connectivity when possible
- respects `HOWICC_API_URL` and `HOWICC_WEB_URL` runtime overrides

Related commands:

- `howicc config:show`
- `howicc config:reset --yes`

### `howicc login`

Starts the browser-based CLI auth flow.

- opens the HowiCC web login page
- prints a manual fallback URL if browser launch fails
- stores the resulting CLI token and user identity locally

Related commands:

- `howicc whoami`
- `howicc logout`

### `howicc list`

Browse local Claude Code sessions with sync-aware labels.

- groups sessions by local project path
- shows whether each session is new, changed since the last sync, or already synced
- summarizes turns, tools, files, languages, commits, and PR references when parsing succeeds

Useful examples:

```bash
howicc list
howicc list --unsynced
howicc list --synced --limit 20
howicc list --all
```

### `howicc sync`

Sync local sessions through the typed upload architecture.

Default behavior is intentionally opinionated:

- verifies CLI auth before doing work
- prefers sessions that look new or changed since the last sync
- asks for confirmation before upload unless `--yes` is passed
- sanitizes privacy findings before upload by default instead of dropping the whole session
- skips unchanged revisions unless `--force` is passed

Privacy handling:

- default `--privacy sanitize` redacts or replaces sensitive message/source content and uploads a placeholder-backed version of the session
- `--privacy strict` keeps the old fail-or-review behavior when you want to inspect every privacy finding manually

Useful examples:

```bash
howicc sync
howicc sync --select
howicc sync --recent 10
howicc sync --privacy strict
howicc sync 01HXYZABCDEF
howicc sync --all --force
```

### `howicc inspect` and `howicc export`

Use these when you need to inspect the canonical pipeline directly or export bundle data for debugging.

```bash
howicc inspect 01HXYZABCDEF
howicc export 01HXYZABCDEF --format canonical
howicc export 01HXYZABCDEF --format render --output /tmp/session.json
```

### `howicc profile`

Aggregates local sessions into the AI coding profile view.

## Packaging

Useful development commands:

```bash
pnpm --filter howicc build
pnpm --filter howicc type-check
pnpm --filter howicc test
pnpm --filter howicc pack:dry-run
```

## Scope

`apps/cli` is the only active CLI surface in this repository.
