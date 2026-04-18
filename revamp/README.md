# HowiCC Revamp

This folder captures the reset plan for HowiCC.

The current product proved the basic idea, but it was built before we understood how Claude Code actually stores sessions on disk. These docs replace the old assumptions with a Claude Code-aware foundation that we can build against with confidence.

> **Where things stand (2026-04-18):** the core sharing loop is live —
> schemas, parser, CLI, contracts, DB, upload path, profile aggregation,
> CLI auth bridge, `/home` (with live feed + stats), and `/s/:slug` (owner
> visibility toggle + public view) are all built end-to-end. `/dashboard`
> 301-redirects to `/home`; `/` is a stub; doc-17 pages 5, 6, 8, 9, 10, 11
> are not yet started. See
> [`platform-rebuild/21-implementation-status.md`](platform-rebuild/21-implementation-status.md)
> for the full audit and residual work (slug collisions, timeline component,
> mobile polish, load-more island, repo/team pages, settings, insights, …).

## Goals

- Preserve what Claude Code really saves instead of flattening it too early.
- Give the CLI clear ownership over discovery, import, parsing, privacy checks, and sync.
- Replace the PocketBase-first design with a Cloudflare-native, modular architecture.
- Define canonical schemas that are reliable for Claude Code now and extensible to other agent platforms later.
- Make the future UI easy to read, easy to reason about, and easy to iterate on without reparsing raw transcripts every time.

## What Changed In Our Understanding

The key architectural shift is:

```text
old: Claude JSONL -> markdown -> guessed messages -> UI
new: Claude disk bundle -> canonical session -> render document -> UI
```

The new plan treats Claude Code as an append-only event log with sidecars, not as a flat chat transcript.

## Document Map

### 1. Claude Code Understanding

Folder: `revamp/claude-code-understanding/`

- `README.md`: scope, principles, and key source references
- `01-filesystem-and-storage.md`: how Claude Code lays out files under `~/.claude`
- `02-transcript-lifecycle.md`: how a prompt becomes transcript lines on disk
- `03-resume-and-recovery.md`: how Claude Code rebuilds a session for resume and preview
- `04-parser-implications.md`: what HowiCC must and must not assume about Claude Code files
- `05-plan-mode-and-plan-files.md`: how plan files are stored, recovered, and bundled
- `06-ask-user-question-and-tool-rejections.md`: how questions, answers, and tool denials persist
- `07-durable-artifacts-beyond-tool-runs.md`: other Claude Code structures worth extracting as first-class artifacts

### 2. CLI Rebuild

Folder: `revamp/cli-rebuild/`

- `README.md`: CLI mission and system boundaries
- `01-cli-responsibilities.md`: what belongs in the CLI versus the backend
- `02-discovery-and-bundling.md`: correct discovery rules and source bundle shape
- `03-canonical-session-schema.md`: canonical storage model for imported sessions
- `04-render-document-schema.md`: UI-ready block model for the frontend
- `05-sync-protocol-and-local-state.md`: upload protocol, revision identity, and local sync state
- `06-privacy-redaction-and-provider-adapters.md`: privacy rules and multi-provider direction
- `07-parser-packages-and-provider-separation.md`: provider package boundaries and parser layering
- `08-claude-code-artifact-extractors.md`: Claude Code-specific extractor inventory and priorities
- `09-session-artifact-union.md`: provider-neutral artifact union and canonical composition
- `10-canonical-to-render-mapping.md`: how artifacts and events become frontend blocks
- `11-architectural-principles-and-invariants.md`: non-negotiable architecture rules for the parser and canonical model
- `12-schema-versioning-and-compatibility.md`: schema/versioning policy for source, canonical, render, and parser layers

### 3. Platform Rebuild

Folder: `revamp/platform-rebuild/`

- `README.md`: target architecture summary
- `01-cloudflare-architecture.md`: Astro, Hono, D1, R2, Queues, and Workers
- `02-monorepo-structure.md`: formal workspace layout and shared packages
- `03-data-model-d1-r2.md`: metadata versus blob storage and the relational model
- `04-api-contracts-hono-openapi.md`: contracts, Hono routing, Zod validation, and Scalar docs
- `05-auth-tokens-and-clients.md`: GitHub auth, session model, and CLI API tokens
- `06-processing-observability-and-operations.md`: queues, reprocessing, logging, and dashboards
- `07-deployment-and-ci-cd.md`: Wrangler, environments, migrations, and GitHub Actions
- `08-migration-plan.md`: migration from the current PocketBase-based system
- `09-package-blueprints.md`: exact initial package/file blueprints for the monorepo
- `10-quality-gates-and-test-strategy.md`: parser fixtures, schema validation, CI gates, and release confidence
- `11-execution-roadmap.md`: phase-by-phase implementation plan from schemas to rollout
- `12-risks-and-open-questions.md`: main technical risks and the questions we should answer deliberately
- `13-environment-and-runtime-configuration.md`: package-owned env contracts, app env composition, and Cloudflare binding boundaries
- `14-repositories-and-project-grouping.md`: repo grouping data model and sync protocol extension
- `15-jtbd-ux-flows-and-user-journey.md`: jobs-to-be-done and full user journey from CLI to shared session
- `16-team-access-and-github-integration.md`: GitHub-gated team access, role mapping, and admin moderation
- `17-web-app-pages-and-screens.md`: complete page inventory with ASCII wireframes and responsive behavior
- `18-data-and-api-per-page.md`: API response shapes and data contracts mapped to each page
- `19-developer-brutalism-prd.md`: **(alternative)** dark terminal brutalism design direction
- `20-design-md-the-archive.md`: **canonical** warm Claude-style design system for the web app
- `21-implementation-status.md`: **live audit** — what's built vs. what these docs describe; pages, endpoints, design system, and the sharing-loop critical path

## Existing Repo Note

The repo is already a minimal `pnpm` workspace with `app/` and `cli/`. The revamp does not introduce workspaces from scratch. Instead, it formalizes the repo into a stronger monorepo with shared contracts, a dedicated API layer, and cleaner package boundaries.

## Reading Order

If you want the full reasoning path, read in this order:

1. `claude-code-understanding/`
2. `cli-rebuild/`
3. `platform-rebuild/`

If you only want the implementation destination, start here:

1. `platform-rebuild/01-cloudflare-architecture.md`
2. `cli-rebuild/03-canonical-session-schema.md`
3. `cli-rebuild/04-render-document-schema.md`

## Working Rule Going Forward

HowiCC should never again depend on markdown as its primary source of truth.

Markdown can remain:

- a convenient export format
- a copy/share format
- a fallback representation for legacy records

But the product should be built on canonical structured data, not reconstructed prose.
