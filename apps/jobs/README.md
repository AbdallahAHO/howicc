# @howicc/jobs

Background worker entrypoint for asynchronous processing in the new HowiCC platform.

## Responsibilities

- reprocessing revisions after parser upgrades
- privacy review follow-up jobs
- future summarization or analysis tasks
- maintenance jobs that should not block API requests

## Environment And Runtime Setup

The jobs app mirrors the API runtime pattern:

- `src/env.ts`
- `src/bindings.ts`
- `src/runtime.ts`

It currently extends package-owned presets from:

- `@howicc/auth/keys`
- `@howicc/db/keys`
- `@howicc/storage/keys`

Use `apps/jobs/.dev.vars.example` as the template for local worker variables once Wrangler wiring lands.

The jobs runtime also resolves database and storage provider configs through the shared `@howicc/db` and `@howicc/storage` helpers.

## Current Status

This is a minimal worker scaffold. It is intentionally small until the upload and revision lifecycle is fully wired through the new API.
