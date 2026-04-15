# Tooling

This folder contains shared build, test, and developer configuration packages for the HowiCC monorepo.

## Why Tooling Lives Here

Configuration packages are not product-domain packages.

They should not sit beside canonical schemas, provider adapters, contracts, or storage libraries. Putting them under `tooling/` keeps the monorepo easier to reason about and follows the strongest part of the `starters/core` pattern.

## Current Tooling Packages

- `typescript/`
  - shared TypeScript configurations used by apps and packages
- `vitest/`
  - shared Vitest configuration helpers for workspace tests

## Future Candidates

We may later move linting and formatting into this folder too, but only after the architecture and parser stack have settled.
