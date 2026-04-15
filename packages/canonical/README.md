# @howicc/canonical

Provider-neutral source-of-truth types for imported conversations.

## What Belongs Here

- canonical session types
- canonical event types
- asset references
- semantic artifact unions
- provider identifiers

## What Stays Elsewhere

- provider-specific parsing logic
- render grouping logic
- API contracts
- database persistence code

## Why This Package Matters

This package is the stable center of the revamp.

Everything else should orbit around it:

- provider adapters build `CanonicalSession`
- render builders consume `CanonicalSession`
- API and storage layers persist and deliver canonical artifacts without redefining them

## Current Status

This is the initial scaffold. It defines the first version of the canonical model and gives the rest of the workspace one place to import from.
