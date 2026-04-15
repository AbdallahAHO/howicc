# @howicc/provider-shared-artifacts

Shared helpers for extracting semantic artifacts across provider adapters.

## What Belongs Here

- artifact extractor context types
- provider-neutral artifact helper utilities
- cross-provider classification helpers for questions, plans, and decisions

## What Stays Elsewhere

- provider-specific filesystem discovery
- provider-specific transcript parsing

## Why This Package Exists

Some concepts will likely recur across providers:

- plans
- question/answer interactions
- tool approvals and rejections
- summarized output artifacts

This package prevents those higher-level concepts from being reimplemented from scratch in every provider adapter.
