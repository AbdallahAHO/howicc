# @howicc/privacy

Provider-neutral privacy detection and deterministic redaction for HowiCC.

## What Belongs Here

- pure text scanning rules
- deterministic text redaction helpers
- provider-neutral segment scanning helpers
- findings, severity, and summary types
- preset rule bundles for sharing and export flows

## What Stays Elsewhere

- provider-specific parsing logic
- CLI prompts and upload policy
- API persistence decisions
- AI-assisted or network verification flows

## Why This Package Exists

Privacy pre-flight needs a stable boundary.

This package takes plain text or text segments, reports what it found, and returns deterministic redactions without needing to know anything about Claude Code, Codex, or the HowiCC CLI.

## Usage

```ts
import {
  inspectSegments,
  inspectText,
  redactSegments,
  redactText,
} from '@howicc/privacy'

const textReport = inspectText(
  'curl http://localhost:3000 && echo SERVICE_TOKEN=plain-text-secret-value',
)

const textResult = redactText(
  'curl http://localhost:3000 && echo SERVICE_TOKEN=plain-text-secret-value',
)

const segmentResult = redactSegments([
  { id: 'user:1', role: 'user', text: 'Email me at abdallah@company.com' },
  { id: 'assistant:1', role: 'assistant', text: 'Run it from /Users/abdallah/project' },
])
```

## API

### `inspectText(text, options?)`

Returns findings and summary counts without mutating the string.

```ts
const report = inspectText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456')

// {
//   findings: [{ ruleId: 'bearer-token', severity: 'block', ... }],
//   summary: { warnings: 0, reviews: 0, blocks: 1 }
// }
```

### `redactText(text, options?)`

Returns the redacted string plus the same structured findings metadata.

```ts
const result = redactText(
  'OPENAI_API_KEY="super-secret-token-value-abcdef"',
)

// {
//   value: 'OPENAI_API_KEY="<redacted-secret>"',
//   changed: true,
//   findings: [
//     {
//       ruleId: 'quoted-secret-assignment',
//       category: 'secret',
//       severity: 'block',
//       start: 16,
//       end: 47,
//       replacement: '<redacted-secret>',
//       maskedPreview: '<redacted-secret>',
//       matchedTextLength: 31,
//     },
//   ],
//   summary: { warnings: 0, reviews: 0, blocks: 1 },
// }
```

### `inspectSegments(segments, options?)`

Aggregates findings across provider-neutral text segments.

```ts
const report = inspectSegments([
  { id: 'event:1', kind: 'message', role: 'user', text: 'See /Users/abdallah/project' },
  { id: 'event:2', kind: 'tool_output', text: 'http://localhost:3000' },
])
```

### `redactSegments(segments, options?)`

Returns copied segments with redacted `text` values while preserving segment metadata.

```ts
const result = redactSegments([
  { id: 'event:1', kind: 'message', role: 'user', text: 'See /Users/abdallah/project' },
  { id: 'event:2', kind: 'tool_output', text: 'http://localhost:3000' },
])

// {
//   value: [
//     { id: 'event:1', kind: 'message', role: 'user', text: 'See /Users/<redacted>/project' },
//     { id: 'event:2', kind: 'tool_output', text: 'http://<local-host>:3000' },
//   ],
//   changed: true,
//   findings: [...],
//   summary: { warnings: 0, reviews: 2, blocks: 0 },
// }
```

## Response Shape

All APIs return or embed the same privacy metadata structure:

- `findings`
  - one entry per selected match after overlap resolution
- `summary`
  - total `warnings`, `reviews`, and `blocks`
- `changed`
  - only on redaction APIs
- `value`
  - only on redaction APIs

Each finding includes:

- `ruleId`
- `category`
- `severity`
- `segmentId`
- `segmentKind`
- `role`
- `path`
- `start`
- `end`
- `matchedTextLength`
- `replacement`
- `maskedPreview`

## Built-In Preset

The default preset is `public-share`.

Current rule families:

- provider tokens and obvious credentials
- quoted or env-style secret assignments
- user home directory paths
- private and local URLs
- emails and phone numbers

The rule catalog is transparent in [publicShare.ts](/Users/abdallah/Developer/personal/howicc/packages/privacy/src/rules/publicShare.ts:1), including external detector inspiration for each rule.

## Test Layout

Tests live under [src/test](/Users/abdallah/Developer/personal/howicc/packages/privacy/src/test), and shared fixture helpers live under [src/test/fixtures](/Users/abdallah/Developer/personal/howicc/packages/privacy/src/test/fixtures).

## Current Status

This first pass focuses on high-confidence public-share rules and fixture-backed regression coverage.

The next layer can add optional AI or verifier adapters without changing the pure core.
