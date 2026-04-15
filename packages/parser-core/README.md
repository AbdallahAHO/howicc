# @howicc/parser-core

Provider-neutral parser primitives for HowiCC.

## What Belongs Here

- source bundle types
- discovered session types
- provider adapter interfaces
- artifact extractor interfaces
- revision hashing helpers

## What Stays Elsewhere

- provider-specific discovery logic
- provider-specific recovery heuristics
- canonical render logic

## Why This Package Exists

This package keeps the parser stack modular.

It gives all provider adapters the same foundation without forcing Claude Code assumptions into future providers.
