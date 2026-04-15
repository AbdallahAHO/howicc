# @howicc/vitest-config

Shared Vitest configuration helpers for the HowiCC monorepo.

## What Belongs Here

- reusable Vitest base config
- future coverage helpers and workspace-wide test utilities

## Why This Is Useful

As packages and apps gain more tests, we want them to share the same test defaults without copy-pasting config files everywhere.

This follows the same basic idea as `starters/core/tooling/vitest`, but kept intentionally smaller for HowiCC's current scope.

## Usage

```ts
import base from '@howicc/vitest-config/base'

export default base
```
