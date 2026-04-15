# @howicc/api

Hono API for the new HowiCC platform.

## Responsibilities

- health and readiness endpoints
- Better Auth handler and auth session entrypoints
- upload session creation
- revision finalization
- render document and artifact delivery
- pricing catalog refresh and read endpoints
- OpenAPI and Scalar docs

## Design Principles

1. Contracts live in `@howicc/contracts`.
2. Routes stay thin and mostly HTTP-focused.
3. Business logic should eventually live in module or service helpers, not inside route files.
4. The API should work as the same contract surface for CLI and web consumers.
5. Local development should run under Wrangler so bindings and D1 behavior stay realistic.

## Environment And Runtime Setup

The API now follows a three-part runtime pattern:

- `src/env.ts`
  - validated string environment variables using `envin`
- `src/bindings.ts`
  - Cloudflare binding placeholders such as D1, R2, and queues
- `src/runtime.ts`
  - composition point for validated env vars and worker bindings

The API env extends package-owned presets from:

- `@howicc/auth/keys`
- `@howicc/db/keys`
- `@howicc/storage/keys`

For local Cloudflare development, use `apps/api/.dev.vars.example` as the template for `apps/api/.dev.vars`.

Important:

- string config belongs in `.dev.vars`
- D1/R2/Queue objects themselves should come from Wrangler bindings, not env files
- Better Auth secrets and GitHub OAuth credentials should be set as Worker secrets in production

Recommended local flow:

1. set local values in `apps/api/.dev.vars`
2. run `pnpm --filter @howicc/api db:prepare:local`
3. run `pnpm --filter @howicc/api dev`

`db:prepare:local` intentionally resets the local D1 state first, then applies tracked Wrangler migrations from `packages/db/migrations`. This avoids schema drift from earlier local experiments or legacy runs.

The API runtime also resolves provider configs through:

- `resolveDatabaseProviderConfig()` from `@howicc/db`
- `resolveStorageProviderConfig()` from `@howicc/storage`

## Auth Mounting

Better Auth is mounted on:

- `GET|POST /auth/*`

This follows the official Better Auth Hono integration pattern while keeping the API on its own subdomain.

Because the frontend will live on `howi.cc` and the API on `api.howi.cc`, the auth package is configured for cross-subdomain cookies.

## Verified OAuth Start Path

The GitHub OAuth start path has been verified against the deployed API:

- `POST https://api.howi.cc/auth/sign-in/social`

with:

- `provider: github`
- `callbackURL: https://howi.cc/`

The API returns the expected GitHub authorize URL with:

- the configured GitHub client id
- redirect URI `https://api.howi.cc/auth/callback/github`
- Better Auth state and PKCE parameters

The same auth start path has also been verified locally with callback:

- `http://localhost:8787/auth/callback/github`

## Session And Protected Demo Routes

The API now also exposes helper/demo routes for the Astro web app:

- `GET /viewer/session`
- `GET /viewer/protected`

These support SSR session helpers, debug pages, and protected-island demos while the full product UI is being built out.

## Current Status

This scaffold now includes a real persistence example beyond conversations:

- fetch and persist the latest OpenRouter pricing catalog
- store normalized model rows in the DB layer
- store raw catalog JSON snapshots in the storage layer

That gives the platform a concrete foundation for future model comparison and conversation-cost features.
