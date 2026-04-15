# Packages

This folder contains the shared libraries that define the new HowiCC architecture.

## Core Principles

- Shared packages define the source-of-truth types and contracts.
- Apps should import from packages rather than re-defining domain shapes locally.
- Provider-specific logic lives in provider packages.
- Packages should remain framework-aware only when necessary and framework-agnostic by default.
- Environment needs should be defined by the package through `keys.ts`, then composed by apps.

## Initial Package Set

- `canonical/`
  - canonical session, event, asset, and artifact types
- `render/`
  - render document types and deterministic block builders
- `privacy/`
  - provider-neutral privacy detection and deterministic redaction
- `parser-core/`
  - provider-neutral import, hashing, and parser helpers
- `provider-claude-code/`
  - Claude Code adapter, recovery rules, and extractors
- `provider-shared-artifacts/`
  - reusable artifact extraction helpers shared across providers
- `contracts/`
  - API contracts shared between CLI, API, and web
- `api-client/`
  - contract-driven HTTP and Hono RPC client helpers
- `model-pricing/`
  - public model catalog, reliable model matching, and session cost estimation
- `db/`
  - Drizzle schema and storage helpers for D1-backed metadata
- `storage/`
  - provider-neutral storage interface with R2-first implementations
- `auth/`
  - auth and token utilities used by API and web

## Tooling Note

Shared build and test configuration lives in `tooling/`, not in `packages/`.

## Test Layout Rule

Package tests live under `src/test/`.

If a package has shared test helpers or fixture loaders, keep them under `src/test/fixtures/` or another clearly named subfolder inside `src/test/`.

Large corpus snapshots, golden files, and fixture-generation scripts also belong under that same `src/test/` home.

Avoid mixing inline `*.test.ts` files beside production modules with package-level test folders. Use one package test home.

## Documentation Rule

Every package gets its own `README.md` with:

- purpose
- responsibilities
- what belongs here
- what stays elsewhere
- current status

If a package needs runtime configuration, its README should also explain:

- which env contract it exports
- whether it is server-only
- how apps are expected to compose it
