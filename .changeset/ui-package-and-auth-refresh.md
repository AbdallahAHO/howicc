---
'@howicc/ui': minor
'@howicc/ui-web': minor
'@howicc/web': minor
'@howicc/auth': minor
'@howicc/api': minor
'@howicc/jobs': patch
---

Scaffold `@howicc/ui` (shared theme tokens, palette, `cn`) and `@howicc/ui-web` (25 shadcn `base-vega` components on `@base-ui/react` with the tweakcn warm-cream theme). The web app rebuilds its auth pages onto the new components and picks up a new `Layout.astro`. `packages/auth` gains a `COOKIE_DOMAIN` override so cross-subdomain cookies are opt-in; localhost/IP dev no longer emits a domain cookie. `apps/api` threads the override through and `apps/api`/`apps/jobs` wranglers run on unique inspector ports to prevent collisions.
