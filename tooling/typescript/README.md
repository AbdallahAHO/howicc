# @howicc/typescript-config

Shared TypeScript configurations for the HowiCC monorepo.

## Why This Is In `tooling/`

This package is infrastructure, not product logic.

Keeping it under `tooling/` makes the monorepo easier to scan and matches the strongest idea from `starters/core`: shared build/test/config packages should sit in a dedicated tooling layer.

## Available Configs

| Config | Use For |
| --- | --- |
| `base.json` | shared foundation, not used directly |
| `library.json` | non-React packages |
| `node.json` | Node.js utilities and scripts |
| `worker.json` | Hono and worker-based runtime apps |
| `astro.json` | Astro web app |
| `react-library.json` | future React component packages |

## Usage

```json
{
  "extends": "@howicc/typescript-config/library.json"
}
```
