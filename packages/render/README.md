# @howicc/render

Frontend-facing render contracts and deterministic block builders for HowiCC.

## What Belongs Here

- render document types
- render block unions
- context builders
- deterministic mapping from canonical sessions to render blocks

## What Stays Elsewhere

- provider parsing logic
- source bundle logic
- API contracts
- database persistence

## Why This Package Exists

The public UI should render from a stable render contract, not from provider-specific events or disk files.

This package is the bridge between canonical truth and user-facing clarity.

## Current Status

This scaffold includes the render types and a first-pass `buildRenderDocument()` function that can evolve as the canonical artifact set grows.
