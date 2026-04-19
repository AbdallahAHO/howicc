# @howicc/web

## 0.1.1

### Patch Changes

- 4e8df66: Tighten the web app under one voice and one top bar. Extract a shared `AppTopBar` (home, sessions, insights, settings all render the same nav and warm-paper background), a shared `SyncFirstSession` empty state (replaces three divergent CLI dumps), and a styled `AccessDenied` page for repo admin 403s. `AccountAvatar` now renders the GitHub image via a native `<img>` so it paints in SSR. User menu and mobile nav wrap `DropdownMenuLabel` in `DropdownMenuGroup` to fix a base-ui `MenuGroupRootContext` error. Copy pass across every page strips internal vocabulary (Wave A–D, revamp doc, `POST /profile/recompute`, `User id`, `Session expires`, `canonical sessions`), collapses container widths to two scales, renders model IDs as friendly labels, lowercases `/r/:owner/:name` with a 301 redirect, and swaps emoji empty states for lucide icons.

## 0.1.0

### Minor Changes

- 4f9e08f: Scaffold `@howicc/ui` (shared theme tokens, palette, `cn`) and `@howicc/ui-web` (25 shadcn `base-vega` components on `@base-ui/react` with the tweakcn warm-cream theme). The web app rebuilds its auth pages onto the new components and picks up a new `Layout.astro`. `packages/auth` gains a `COOKIE_DOMAIN` override so cross-subdomain cookies are opt-in; localhost/IP dev no longer emits a domain cookie. `apps/api` threads the override through and `apps/api`/`apps/jobs` wranglers run on unique inspector ports to prevent collisions.

### Patch Changes

- Updated dependencies [4f9e08f]
  - @howicc/ui@0.2.0
  - @howicc/ui-web@0.2.0
  - @howicc/auth@0.1.0

## 0.0.3

### Patch Changes

- @howicc/auth@0.0.2

## 0.0.2

### Patch Changes

- 1478dca: Introduce versioned release automation for the CLI, API, web app, and jobs worker, with separate GitHub releases, Cloudflare deployment workflows, and production migration safeguards.
