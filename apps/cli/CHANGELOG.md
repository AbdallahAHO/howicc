# howicc

## 2.0.2

### Patch Changes

- 0655f8a: Fix `npx howicc` and `npm install -g howicc` failing with `EUNSUPPORTEDPROTOCOL workspace:*`. The CLI bundle is self-contained via `tsup noExternal`, so all bundled packages are now declared under `devDependencies` and the published tarball ships with zero runtime `dependencies`. Release CI switches to `pnpm publish` so workspace protocol is always rewritten at publish time.

## 2.0.1

### Patch Changes

- 1478dca: Introduce versioned release automation for the CLI, API, web app, and jobs worker, with separate GitHub releases, Cloudflare deployment workflows, and production migration safeguards.
