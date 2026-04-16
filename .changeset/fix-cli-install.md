---
'howicc': patch
---

Fix `npx howicc` and `npm install -g howicc` failing with `EUNSUPPORTEDPROTOCOL workspace:*`. The CLI bundle is self-contained via `tsup noExternal`, so all bundled packages are now declared under `devDependencies` and the published tarball ships with zero runtime `dependencies`. Release CI switches to `pnpm publish` so workspace protocol is always rewritten at publish time.
