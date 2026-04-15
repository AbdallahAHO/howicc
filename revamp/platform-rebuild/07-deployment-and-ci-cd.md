# Deployment And CI/CD

This document describes the target deployment and automation setup.

## Deployment Goals

- predictable Cloudflare deployments
- clear separation of staging and production
- repeatable D1 migrations
- safe rollout for API and web changes
- contract-aware CI checks

## Recommended Deploy Targets

- `apps/web` -> Cloudflare Worker or Pages/Workers deployment for Astro
- `apps/api` -> Cloudflare Worker running Hono
- `apps/jobs` -> Cloudflare Worker queue consumer

## Wrangler Strategy

Use Wrangler-managed environments for at least:

- `development`
- `staging`
- `production`

Each environment should have distinct bindings for:

- D1
- R2
- Queues
- secrets
- service bindings if used

## CI Pipeline Suggestions

### On Pull Requests

- install dependencies
- lint
- type-check
- run unit tests
- validate contract generation
- validate Drizzle schema and migration files

### On Main Branch

- build web, API, and job worker artifacts
- deploy staging or production depending on branch strategy
- apply D1 migrations in the right environment
- publish updated API docs

## CD Safety Rules

1. Do not deploy code that expects migrations before applying them.
2. Keep migrations explicit and versioned.
3. Make contract generation part of CI so route drift is caught early.
4. Keep resource names environment-specific.

## Suggested GitHub Actions Shape

Useful workflows:

- `ci.yml`
- `deploy-staging.yml`
- `deploy-production.yml`
- `contracts-check.yml`

## Preview Strategy

For the web app, preview deployments on pull requests are valuable.

For the API, staging is more important than ad-hoc previews because the CLI depends on stable contract-aware environments.

## Infrastructure As Code Direction

Wrangler config should be committed and versioned.

The repo should make it easy to answer:

- which worker owns which route
- which D1 database is used in each environment
- which queue feeds which processor
- which R2 bucket stores which artifact class
