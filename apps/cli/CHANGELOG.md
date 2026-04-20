# howicc

## 2.2.0

### Minor Changes

- fc2dc04: - Sanitize privacy findings during sync by default so sensitive sessions can still upload with explicit placeholders instead of failing the whole run.
  - Add `howicc sync --privacy strict` for the old block-and-review behavior when you want manual privacy approval.
  - Speed up sync planning by avoiding eager revision hashing before session selection and improve preview output to show the upload-safe sanitized payload.

## 2.1.0

### Minor Changes

- 377301b: - Clean up rebased API client types
  - Fix sync slug collisions and review prompts
  - Polish CLI login callback page
  - Unify the web app under one voice and one top bar
  - Harden public profile aggregation and archive surfaces
  - API tokens CRUD for the settings page
  - resource-asset endpoint + unified content drawer

## 2.0.2

### Patch Changes

- 0655f8a: Fix `npx howicc` and `npm install -g howicc` failing with `EUNSUPPORTEDPROTOCOL workspace:*`. The CLI bundle is self-contained via `tsup noExternal`, so all bundled packages are now declared under `devDependencies` and the published tarball ships with zero runtime `dependencies`. Release CI switches to `pnpm publish` so workspace protocol is always rewritten at publish time.

## 2.0.1

### Patch Changes

- 1478dca: Introduce versioned release automation for the CLI, API, web app, and jobs worker, with separate GitHub releases, Cloudflare deployment workflows, and production migration safeguards.
