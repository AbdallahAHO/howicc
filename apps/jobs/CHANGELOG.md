# @howicc/jobs

## 0.0.6

### Patch Changes

- 8cfcd55: - align production D1 binding

## 0.0.5

### Patch Changes

- @howicc/auth@0.1.1

## 0.0.4

### Patch Changes

- 4f9e08f: Scaffold `@howicc/ui` (shared theme tokens, palette, `cn`) and `@howicc/ui-web` (25 shadcn `base-vega` components on `@base-ui/react` with the tweakcn warm-cream theme). The web app rebuilds its auth pages onto the new components and picks up a new `Layout.astro`. `packages/auth` gains a `COOKIE_DOMAIN` override so cross-subdomain cookies are opt-in; localhost/IP dev no longer emits a domain cookie. `apps/api` threads the override through and `apps/api`/`apps/jobs` wranglers run on unique inspector ports to prevent collisions.
- Updated dependencies [4f9e08f]
  - @howicc/auth@0.1.0

## 0.0.3

### Patch Changes

- Updated dependencies [297bdcb]
  - @howicc/db@0.0.2
  - @howicc/auth@0.0.2

## 0.0.2

### Patch Changes

- 1478dca: Introduce versioned release automation for the CLI, API, web app, and jobs worker, with separate GitHub releases, Cloudflare deployment workflows, and production migration safeguards.
