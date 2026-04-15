# Apps

This folder contains the deployable HowiCC applications.

## Current Apps

- `web/`
  - Astro frontend for the product website and authenticated app shell
- `api/`
  - Hono API that owns upload sessions, revision finalization, artifact access, and OpenAPI docs
- `jobs/`
  - Background worker entrypoint for queues, reprocessing, and async post-upload tasks
- `cli/`
  - the new command-line app built around the typed API client and provider adapters

## Design Rules

1. Apps consume packages. Packages never depend on apps.
2. Apps should stay thin where possible.
3. Shared contracts, canonical schemas, and render logic belong in `packages/`.
4. Every app has its own `README.md`, `package.json`, and `tsconfig.json`.
5. App runtime config belongs in `env.ts`, not scattered `process.env` calls.

## Environment Pattern

Apps own their final runtime composition.

- `env.ts`
  - string-based validated environment variables
- `bindings.ts`
  - Cloudflare object bindings when applicable
- `runtime.ts`
  - merges both into one application runtime shape

Shared packages only export env contracts or presets through `keys.ts`.
