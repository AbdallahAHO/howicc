# @howicc/auth

## 0.1.1

### Patch Changes

- Updated dependencies [377301b]
  - @howicc/contracts@0.1.0

## 0.1.0

### Minor Changes

- 4f9e08f: Scaffold `@howicc/ui` (shared theme tokens, palette, `cn`) and `@howicc/ui-web` (25 shadcn `base-vega` components on `@base-ui/react` with the tweakcn warm-cream theme). The web app rebuilds its auth pages onto the new components and picks up a new `Layout.astro`. `packages/auth` gains a `COOKIE_DOMAIN` override so cross-subdomain cookies are opt-in; localhost/IP dev no longer emits a domain cookie. `apps/api` threads the override through and `apps/api`/`apps/jobs` wranglers run on unique inspector ports to prevent collisions.

## 0.0.2

### Patch Changes

- Updated dependencies [297bdcb]
  - @howicc/db@0.0.2
