# @howicc/model-pricing

Shared model catalog, matching, and cost estimation helpers for HowiCC.

## What Belongs Here

- public model catalog fetching
- normalized catalog shapes
- model-id matching helpers
- provider-aware alias logic
- session cost estimation from usage timelines

## What Stays Elsewhere

- provider transcript parsing
- provider-specific usage extraction
- render-layer formatting

## Why This Package Exists

Cost estimation is useful across providers, but it should not live inside any one provider adapter.

This package keeps pricing logic reusable and auditable:

- provider adapters extract usage timelines
- `@howicc/model-pricing` matches those model ids to catalog entries
- cost estimates are computed separately from parsing

## Current Focus

The first implementation targets OpenRouter's public models catalog and reliable matching for the Claude-family model ids that appear in your local Claude Code transcripts.

The matcher is intentionally conservative. It prefers:

1. exact OpenRouter ids
2. exact canonical slugs
3. generated, strongly structured aliases

It does not guess vague shorthand model names like `sonnet`.

## Persistence Role

This package does not persist catalogs itself.

Instead it provides:

- fetch helpers for the public OpenRouter models payload
- normalization into a stable internal catalog shape
- matching and estimation logic

The API layer can then persist:

- raw catalog JSON snapshots
- normalized model rows

without mixing storage concerns into the pricing package.

## Current Matching Policy

Matching is intentionally layered:

1. exact id
2. exact canonical slug
3. generated Anthropic/OpenRouter aliases
4. contextual family alias at session-estimation time only

This gives us better real-world accuracy while staying conservative about ambiguous local model names.
