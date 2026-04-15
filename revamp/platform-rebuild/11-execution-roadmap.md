# Execution Roadmap

This document translates the revamp into a realistic build sequence.

The goal is to avoid trying to rebuild everything in one chaotic step.

## Guiding Strategy

Build the revamp from the inside out:

1. schemas
2. parser
3. render layer
4. contracts
5. storage and API
6. web app
7. migration and rollout

That lets the most foundational pieces settle first.

## Phase 0: Lock The Design

Outcome:

- revamp docs are complete enough to implement from

Tasks:

- finalize canonical session shape
- finalize render document shape
- finalize artifact union
- finalize package boundaries

Acceptance:

- no major schema ambiguity remains

## Phase 1: Create Core Packages

Outcome:

- `packages/canonical`
- `packages/render`
- `packages/parser-core`

Tasks:

- add package scaffolds
- add TypeScript build setup
- add Zod schemas
- add basic tests

Acceptance:

- canonical and render schemas validate example documents

## Phase 2: Build The Claude Code Adapter

Outcome:

- `packages/provider-claude-code`

Tasks:

- implement discovery
- implement source bundle builder
- implement transcript parsing and branch recovery
- implement first-wave artifact extractors

First-wave extractors:

- plans
- questions
- tool decisions
- tool outputs

Acceptance:

- fixture-driven tests pass for first-wave Claude Code imports

## Phase 3: Produce Canonical And Render Outputs Locally

Outcome:

- the CLI can inspect and preview local imports before any backend work

Tasks:

- add `howicc inspect`
- add `howicc export`
- add `howicc preview`

Acceptance:

- local import of anonymized fixtures produces stable canonical and render outputs

## Phase 4: Add Contracts And Database Layer

Outcome:

- `packages/contracts`
- `packages/db`

Tasks:

- define API contracts
- define Drizzle schema for D1
- define revision and asset storage model

Acceptance:

- contract schemas and DB schema compile and validate in CI

## Phase 5: Build API And Storage Path

Outcome:

- `apps/api`
- upload/finalize path works end-to-end

Tasks:

- implement Hono routes
- implement draft upload session persistence
- implement API-mediated asset upload into R2 draft keys
- implement finalize-time promotion into revision keys
- persist revision metadata to D1
- enqueue post-upload jobs
- implement stored render reads from revision assets

Acceptance:

- CLI can upload canonical, render, and bundle artifacts successfully
- API can return a stored render document from the latest revision without reparsing local source data

## Phase 6: Build The Web App On Render Documents

Outcome:

- `apps/web` reads `render_document` instead of markdown-first data

Tasks:

- implement public conversation page
- implement block renderers
- implement plan context and question blocks
- implement expandable artifact output

Acceptance:

- a real imported Claude Code conversation renders correctly from render JSON only

## Phase 7: Add Auth, Tokens, And User Flows

Outcome:

- GitHub auth
- CLI token issuance
- user settings area

Tasks:

- add auth package wiring
- add token management UI
- add owner-only revision and publish flows

Acceptance:

- authenticated sync works with CLI tokens

## Phase 8: Post-Upload Processing And Ops

Outcome:

- job workers
- analysis
- observability

Tasks:

- queue consumers
- privacy revalidation
- summary generation if desired
- error and job monitoring

Acceptance:

- revision processing is observable and recoverable

## Phase 9: Legacy Transition

Outcome:

- old records remain viewable
- new records use the new model

Tasks:

- mark legacy markdown records clearly
- avoid fake migrations unless they are truly reliable
- move traffic and docs to the new import path

Acceptance:

- new system handles all new imports
- old system is no longer the ingestion default

## Practical First Milestone

If we want the strongest first milestone, I would target this bundle:

1. `packages/canonical`
2. `packages/render`
3. `packages/provider-claude-code`
4. CLI local `inspect/export/preview`

That would prove the hardest part of the revamp before backend complexity enters.

## What Not To Do

Avoid this order:

1. build the new API first
2. build the DB first
3. keep parser details vague

That would force backend decisions before the source-of-truth model is stable.

## Milestone Definition

Each phase should end with:

- updated docs
- passing tests
- at least one working end-to-end path for that layer

That discipline will keep the rebuild coherent.
