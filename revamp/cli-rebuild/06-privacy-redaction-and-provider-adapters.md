# Privacy, Redaction, And Provider Adapters

This document covers two related concerns:

1. privacy and redaction during local import
2. the path toward supporting more than Claude Code

## Privacy First Means Pre-Upload Checks

Because agent transcripts often contain sensitive local material, HowiCC should perform privacy checks before upload.

The CLI should inspect:

- user message text
- assistant message text
- tool inputs
- tool outputs
- persisted artifact bodies
- hook output
- filesystem paths

## Suggested Privacy Stages

### Stage 1: Detection

Detect:

- access tokens
- API keys
- passwords
- emails and phone numbers
- local absolute filesystem paths
- private hostnames and local development URLs

### Stage 2: Classification

Classify findings into:

- warning
- requires review
- block public upload

### Stage 3: Redaction

Allow deterministic masking such as:

- `/Users/abdallah/...` -> `/Users/<redacted>/...`
- `ghp_abc...` -> `ghp_<redacted>`

### Stage 4: Preview

Let the user inspect a redacted render preview before sync.

## Adapter Design For Future Providers

We should not bake Claude Code assumptions into the entire product.

Instead, use provider adapters that map source files into the same canonical session schema.

## Recommended Adapter Interface

```ts
type ProviderAdapter = {
  provider: string
  displayName: string
  discoverSessions(): Promise<DiscoveredSession[]>
  buildSourceBundle(session: DiscoveredSession): Promise<SourceBundle>
  parseCanonicalSession(bundle: SourceBundle): Promise<CanonicalSession>
  redactCanonicalSession(input: CanonicalSession): Promise<CanonicalSession>
}
```

## Why This Helps Beyond Claude Code

A lot of local-first or agentic tools are converging on filesystem-backed conversation storage.

If we keep the canonical schema generic enough, HowiCC can support later:

- OpenAI Codex
- future terminal agents
- editor-native agents
- custom local assistant logs

## Boundary Rule

Provider-specific parsing belongs in the adapter.

Provider-neutral concepts belong in:

- canonical session schema
- render document schema
- sync contract
- frontend renderer

That keeps the system modular and avoids another Claude-only rewrite later.
