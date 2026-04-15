# Environment And Runtime Configuration

This document defines how HowiCC should handle environment variables and runtime bindings.

The goal is to keep configuration:

- package-owned where appropriate
- app-composed at the boundary
- portable across runtimes
- Cloudflare-friendly without baking Cloudflare into every package

## Design Rule

Split runtime configuration into two classes.

### 1. String Environment Variables

These include:

- URLs
- secrets
- provider selections
- feature flags
- product metadata

These should be validated with `envin`.

### 2. Runtime Bindings

These include:

- D1 database bindings
- R2 buckets
- queues
- service bindings

These should not be forced through the same string-env schema. They should live in `bindings.ts` and be merged into runtime context separately.

## Package-Owned Contracts

Packages that need runtime configuration should export their own env contracts through `keys.ts`.

Examples:

- `@howicc/db/keys`
- `@howicc/storage/keys`
- `@howicc/auth/keys`

Those contracts describe what the package needs, but not how the final app runtime should be assembled.

Where useful, packages may also export provider config resolvers that turn validated env values into runtime-ready adapter config. For example:

- `resolveDatabaseProviderConfig()`
- `resolveStorageProviderConfig()`

## App-Owned Composition

Apps should own their final composition in `env.ts`.

Examples:

- `apps/api/src/env.ts`
- `apps/jobs/src/env.ts`
- `apps/web/src/env.ts`

The app decides:

- which package presets to extend
- which app-specific variables to add
- whether the runtime is server-only or public/client-aware

## Worker Runtime Split

For Cloudflare-oriented apps, use this structure:

```text
env.ts       -> string env validation
bindings.ts  -> D1/R2/Queue binding types
runtime.ts   -> combine validated env + bindings
```

This gives us:

- typed app configuration
- typed runtime binding expectations
- a cleaner path from Node dev to Worker deployment
- one place to turn env values into provider config without duplicating branching logic

## Why This Is Better Than One Giant Env Object

Because `process.env`-style values and Worker bindings are different kinds of things.

- one is string-based configuration
- the other is live runtime infrastructure objects

Trying to model both as the same thing makes the runtime harder to reason about.

## Why `envin` Fits

`envin` is a good fit here because it gives us:

- composable presets
- strong client/server boundaries
- framework-agnostic usage
- live preview if we want it later

It complements the `keys.ts` ownership style we liked in `really-app` and the preset composition style used in `starters/core`.

## Current HowiCC Direction

The recommended pattern is:

```text
package keys.ts
-> app env.ts
-> app bindings.ts
-> app runtime.ts
```

## Example File Layout

```text
packages/
  db/
    src/keys.ts
  storage/
    src/keys.ts
  auth/
    src/keys.ts

apps/
  api/
    src/env.ts
    src/bindings.ts
    src/runtime.ts
  jobs/
    src/env.ts
    src/bindings.ts
    src/runtime.ts
  web/
    src/env.ts
```

## Example Env File Strategy

### Root

- `.env.example`
  - shared local defaults and documented variables

### Web

- `apps/web/.env.example`
  - public app-specific variables
- `apps/web/.env.local`
  - local overrides, not committed

### Worker Apps

- `apps/api/.dev.vars.example`
- `apps/jobs/.dev.vars.example`

These are for Wrangler local development.

Important:

- string vars go in `.dev.vars`
- D1/R2/Queue bindings belong in Wrangler config, not in `.dev.vars`

## Cloudflare Recommendation

When Wrangler setup lands:

- keep secrets in Wrangler/Cloudflare secrets
- keep non-secret string vars in `vars`
- keep object bindings in the Worker bindings section

The code should continue to consume those through the `env.ts` + `bindings.ts` split.

## Testing And E2E Implication

This design also gives us a clean path for E2E and local setup later:

- root env can act as the source of truth for shared local defaults
- app-specific example files can derive from that
- a future setup script can distribute local values into the correct app files if needed

## Current Recommendation

Invest in this now, but keep it focused.

What we need immediately:

1. package-owned env contracts
2. app-owned env composition
3. explicit worker binding boundaries
4. documented example env files

What we do not need yet:

1. complex secret sync automation
2. full env CLI workflows
3. advanced preview or deployment tooling around envs

That gives us a reliable configuration foundation without overbuilding it.
