# HowiCC

HowiCC turns local coding-agent conversations into structured, shareable artifacts.

This monorepo contains the full product surface:

- a web app for browsing and sharing sessions
- an API for auth, uploads, and artifact delivery
- background jobs for async processing
- a CLI for working with local machine data
- shared packages for canonical session models, provider adapters, privacy, rendering, storage, and contracts

## Repo Shape

```text
apps/
  web/   Astro app
  api/   Hono API on Cloudflare Workers
  jobs/  background worker
  cli/   local CLI

packages/
  canonical/
  provider-claude-code/
  parser-core/
  privacy/
  render/
  profile/
  contracts/
  api-client/
  auth/
  db/
  storage/
  ...
```

`app/` still exists as a legacy reference during the migration, but the active product lives in `apps/` and `packages/`.

## Stack

- TypeScript monorepo
- pnpm workspaces
- Turbo
- Astro for web
- Hono on Cloudflare Workers
- D1 for metadata
- R2 for assets

## Quick Start

Requirements:

- Node 24
- pnpm 9

Install dependencies:

```bash
nvm use
pnpm install
```

Run the main local stack:

```bash
pnpm dev:local
```

That prepares the local API database, then starts the web app and API together.

Useful commands:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:jobs
pnpm dev:cli

pnpm type-check
pnpm test
pnpm build
```

Targeted validation:

```bash
pnpm run ci:web
pnpm run ci:api
pnpm run ci:jobs
pnpm run ci:cli
```

## Release Model

HowiCC ships separate release surfaces for:

- `@howicc/web`
- `@howicc/api`
- `@howicc/jobs`
- `howicc`

At a high level:

1. feature work lands through pull requests
2. release-impacting PRs include a changeset
3. merging to `main` updates the release PR
4. merging the release PR bumps versions and changelogs
5. surface-specific workflows create tags, GitHub Releases, and deployments

The CLI uses npm Trusted Publishing from GitHub Actions. The web, API, and jobs apps deploy through separate Cloudflare workflows.

## Contributing

`main` is PR-only and squash-only.

Before opening a PR:

- use a conventional branch name
- use a Conventional Commit PR title
- add a changeset when a release surface changes
- run the narrowest relevant checks locally

The full contributor and release policy lives in [CONTRIBUTING.md](CONTRIBUTING.md).

## Where To Look Next

- [apps/README.md](apps/README.md) for deployable app boundaries
- [packages/README.md](packages/README.md) for shared library structure
- [apps/web/README.md](apps/web/README.md) for the frontend
- [apps/api/README.md](apps/api/README.md) for the API
- [apps/cli/README.md](apps/cli/README.md) for the CLI
- [revamp/](revamp/) for architecture and migration notes
