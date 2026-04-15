# @howicc/web

Astro frontend for the new HowiCC platform.

## Responsibilities

- public conversation pages
- authenticated app shell
- polished artifact-driven transcript UI
- human-friendly browsing and sharing flows

## Current Architecture Direction

The web app is now moving toward:

- Astro SSR on Cloudflare
- React islands for auth/session interactions
- middleware-backed request auth state
- protected SSR routes and debug views

## Current Auth Entry Points

The first web auth slice is now live:

- `/`
  - landing page with a GitHub sign-in CTA
- `/login`
  - GitHub sign-in entrypoint
- `/dashboard`
  - protected SSR page that redirects unauthenticated users to `/login`
- `/debug/auth`
  - SSR auth debug page with a protected React island demo

The login flow points to the API auth handler at:

- `https://api.howi.cc/auth/*`

For local development, the same flow works with:

- `http://localhost:4321`
- `http://localhost:8787/auth/*`

The local GitHub OAuth app should use callback:

- `http://localhost:8787/auth/callback/github`

## Cloudflare Deployment

The web app is now configured for Astro SSR on Cloudflare via:

- `apps/web/wrangler.jsonc`
- `pnpm --filter @howicc/web cf:deploy`

The worker/project name is:

- `howicc-web`

The long-term production domain target is:

- `howi.cc`

## Design Rules

1. The frontend should consume render documents, not raw source files.
2. The web app should depend on `@howicc/api-client` rather than inventing local fetch contracts.
3. The conversation page should stay block-driven so new artifact types can land cleanly.
4. SSR auth state should be resolved through middleware and helpers, not reimplemented in each page.

## Environment Setup

The Astro app now owns a typed env entrypoint in `src/env.ts`.

It validates:

- `API_SERVER_URL`
- `PUBLIC_PRODUCT_NAME`
- `PUBLIC_SITE_URL`
- `PUBLIC_API_URL`

Use `apps/web/.env.example` as the template for `apps/web/.env.local`.

The web app now uses:

- public browser config
- server-side internal API URL for SSR session fetches

## Current Status

The first real SSR auth layer is now present:

- middleware session lookup
- protected dashboard route
- auth debug route
- React island demo for logout and protected fetches
