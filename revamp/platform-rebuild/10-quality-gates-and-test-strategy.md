# Quality Gates And Test Strategy

This document defines how we keep the revamp reliable as it moves from research into implementation.

The parser, contracts, storage model, and UI are all changing at once. Without a strong testing strategy, the system will become inconsistent quickly.

## What We Need To Protect

The most important things to protect are:

- import fidelity
- schema validity
- privacy handling
- revision correctness
- public rendering correctness
- deployment safety

## Testing Layers

## 1. Fixture-Based Parser Tests

These are the most important tests in the system.

Use anonymized real-world session bundles as fixtures.

Each fixture should include:

- transcript file
- relevant sidecars
- expected canonical session snapshot
- expected render document snapshot

Suggested fixture classes:

- simple user/assistant session
- Bash-heavy coding session
- plan mode session
- AskUserQuestion session
- rejected tool session
- subagent session
- MCP resource session
- persisted large output session
- compacted/resumed session

## 2. Canonical Schema Validation Tests

Every built canonical session should validate against the canonical schema.

Protects against:

- drift between parser and model
- accidental breaking changes
- invalid optional/required fields

## 3. Render Document Validation Tests

Every built render document should validate against the render schema.

This protects the public page and the API contract.

## 4. Artifact Extractor Tests

Each extractor should have focused tests.

Examples:

- `plans.test.ts`
- `questions.test.ts`
- `toolDecisions.test.ts`
- `todos.test.ts`

These tests should cover:

- happy path
- missing-file fallback path
- compacted transcript path
- rejection or partial path

## 5. Contract Tests

The API contract package should be tested so:

- CLI request bodies match API validation
- route schemas remain in sync
- generated OpenAPI output remains correct

Useful gates:

- build contracts
- validate OpenAPI generation
- ensure Hono route implementations satisfy contract schemas

## 6. Database And Migration Tests

Drizzle schema and migration files should be validated in CI.

Protects against:

- broken migration sequences
- schema drift between code and database
- invalid assumptions about nullable fields or indexes

## 7. Web Rendering Tests

The public renderer should have tests for:

- question blocks
- activity groups
- callouts
- plan context
- subagent threads
- todo and task timeline blocks later

Useful layers:

- unit tests for render helpers
- component tests for major block types
- a small number of integration tests for end-to-end page rendering

## 8. Privacy And Redaction Tests

These should not be an afterthought.

We need tests for:

- path redaction
- token and secret detection
- command output redaction
- plan file redaction
- question-note redaction

Use realistic fixture examples rather than toy strings only.

## 9. End-To-End Import Tests

Have a test flow like:

```text
fixture bundle
-> provider parser
-> canonical session
-> render document
-> validate both schemas
-> compare stable snapshots
```

This is the main confidence loop for the system.

## Quality Gates In CI

Recommended CI gates:

1. lint
2. type-check
3. unit tests
4. parser fixture tests
5. contract generation and validation
6. Drizzle migration validation
7. web build
8. API build

## Golden Snapshot Strategy

For canonical sessions and render documents, snapshot tests are useful if they are disciplined.

Rules:

- snapshot normalized JSON, not unstable debug output
- keep fixtures small and well-named
- prefer one fixture per behavior class
- update snapshots intentionally, not casually

## Performance Gates

The parser should also have basic performance expectations.

Suggested soft checks:

- large transcript import should complete within acceptable CI limits
- render generation should be much cheaper than reparsing source
- preview listings should not require full transcript parsing for every session

## Deployment Quality Gates

Before production deploys:

- migrations are validated
- contracts compile
- workers build cleanly
- web app renders on staging
- at least a smoke import path works end-to-end

## Definition Of Done For The Rebuild

An implementation milestone should not be considered done unless:

1. the schema is documented
2. canonical and render outputs are validated
3. parser fixtures cover the behavior
4. at least one end-to-end import test exists
5. the public UI has a deterministic rendering path

That is the standard we want for the revamp.
