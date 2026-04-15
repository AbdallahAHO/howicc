# @howicc/auth

Shared Better Auth server and client primitives for HowiCC.

## What Belongs Here

- Better Auth server factory
- Better Auth client entrypoints
- auth-related types shared between API and web
- token hashing and comparison helpers

## Environment Contract

This package exports a package-owned env contract in `@howicc/auth/keys`.

It currently defines:

- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Apps compose this preset in their own `env.ts` rather than reading `process.env` directly.

## What Stays Elsewhere

- Hono route mounting details
- frontend auth UI flows
- database runtime binding setup

## Better Auth Direction

This package now follows the Better Auth integration shape intentionally:

- `src/server.ts`
  - exports `createHowiccAuth()` for the API runtime
- `src/client/vanilla.ts`
  - exports a vanilla Better Auth client for Astro or plain browser code

The API is responsible for mounting the handler on Hono and passing runtime bindings such as the D1-backed Drizzle instance.

## Current Status

This package is now the base for the real auth path:

- Better Auth server factory
- GitHub provider configuration when credentials are present
- cross-subdomain cookie configuration for `howi.cc` and `api.howi.cc`

The next layer will be:

- D1 migration application in the remote environment
- secret wiring in Wrangler
- Astro client/session integration
