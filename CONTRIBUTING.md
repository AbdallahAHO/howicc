# Contributing to HowiCC

This repo ships from the monorepo in the root, not from `app/`.

## Local setup

```bash
nvm use
pnpm install
pnpm type-check
pnpm build
```

The repo standard is Node 24. Use either `.nvmrc` or `.node-version`.

## Daily workflow

Create a branch from `main`, make the smallest coherent change you can, and run the narrowest relevant checks before you push.

`main` is intended to be PR-only. Merge through pull requests using squash merge only.

Common commands:

```bash
pnpm dev:local
pnpm dev:web
pnpm dev:api
pnpm dev:jobs
pnpm dev:cli
```

Targeted CI commands:

```bash
pnpm run ci:web
pnpm run ci:api
pnpm run ci:jobs
pnpm run ci:cli
```

Safe deploy validation commands:

```bash
pnpm deploy:check:web
pnpm deploy:check:api
pnpm deploy:check:jobs
```

## Release flow

Production releases are tracked separately for:

- `@howicc/web`
- `@howicc/api`
- `@howicc/jobs`
- `@howicc/cli`

If a pull request changes one of those surfaces, add a changeset:

```bash
pnpm exec changeset add
```

The merged flow is:

1. PR merges into `main`
2. `release-plan.yml` opens or updates the release PR
3. merging the release PR bumps package versions and changelogs
4. surface-specific workflows create tags, GitHub Releases, and deployments

Use this before opening a PR when you touch release surfaces:

```bash
pnpm run release:status
```

## Branch and PR policy

Use gitflow-style branch names:

- `feature/...`
- `feat/...`
- `fix/...`
- `hotfix/...`
- `release/...`
- `chore/...`
- `docs/...`
- `refactor/...`
- `test/...`
- `ci/...`
- `perf/...`
- `build/...`

Pull request titles must follow Conventional Commits because squash merge is the only allowed merge method on `main`.

Examples:

- `feat(web): add release status overview`
- `fix(api): gate deploy on worker secret sync`
- `chore(release): prepare v1.0.0`

## Production environments

GitHub environments:

- `npm-release`
- `production-web`
- `production-api`
- `production-jobs`
- `production-db`

The CLI publish workflow uses npm Trusted Publishing from GitHub Actions, not an npm token. Configure the npm package to trust:

- repository: `AbdallahAHO/howicc`
- workflow: `release-cli.yml`
- environment: `npm-release`

The API deployment also syncs required Worker secrets from the `production-api` environment before deploy:

- `BETTER_AUTH_SECRET`
- `SHARE_TOKEN_SECRET`

Optional production auth secrets:

- `GH_OAUTH_CLIENT_ID`
- `GH_OAUTH_CLIENT_SECRET`

If you need to reconcile production API Worker secrets outside a release deploy, run the `Sync API Secrets` workflow manually.

## Legacy app

`app/` still exists as a reference during the migration. Its local contributing guide is scoped to that legacy app and should not be used as the source of truth for the monorepo release process.
