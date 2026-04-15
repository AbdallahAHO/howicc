# Risks And Open Questions

This document captures the main technical risks in the revamp and the questions we should answer deliberately rather than discovering them mid-implementation.

## Main Risks

## 1. Privacy Risk

Claude Code transcripts can contain:

- local paths
- secrets in command output
- plan text with sensitive context
- notes and annotations
- uploaded attachments

Mitigation:

- pre-upload CLI inspection
- redaction tests
- server-side second-pass review
- safe defaults for visibility

## 2. Parser Drift Risk

Claude Code can evolve its transcript and attachment shapes over time.

Mitigation:

- preserve unknown events
- fixture-based tests
- provider package isolation
- schema versioning discipline

## 3. Large Output Storage Risk

Persisted tool outputs and attachments can grow quickly.

Mitigation:

- R2 for large payloads
- preview-plus-lazy-load rendering
- artifact/asset separation

## 4. D1 Scaling Risk

D1 is fine for metadata, but not for heavy blob storage or overly chatty relational access patterns.

Mitigation:

- keep blobs in R2
- keep metadata queries focused
- use Drizzle so migration to another SQL backend stays feasible

## 5. Schema Churn Risk

If we change canonical and render schemas too often, implementation becomes unstable.

Mitigation:

- additive changes first
- parserVersion for frequent iteration
- schemaVersion changes only when truly necessary

## 6. UI Overreach Risk

If we try to support every Claude Code structure in V1, the renderer will become too broad too early.

Mitigation:

- prioritize first-wave artifacts
- leave lower-priority structures as typed canonical data first

## 7. Legacy Data Confusion Risk

Users may assume old markdown-based shares are equivalent to new imports.

Mitigation:

- clearly mark legacy records
- keep migration claims conservative

## Open Questions

## 1. How Much Of The Canonical Session Should Be Searchable?

Options:

- metadata only
- metadata plus artifact summaries
- selected transcript text

Recommendation now:

- metadata plus artifact summaries and carefully chosen transcript text

## 2. Should We Store Full Canonical JSON In D1 For Convenience?

Recommendation:

- no
- keep it in R2 and only store metadata in D1

## 3. Should The Web App Fetch Render JSON Directly From R2 Or Through The API?

Recommendation:

- start through controlled API or signed access path
- keeps visibility and future transformations simpler

## 4. How Aggressive Should Redaction Be By Default?

Recommendation:

- path masking and obvious secret masking should be automatic
- more ambiguous content should require review

## 5. Should We Support In-Place Reprocessing Of Existing Revisions?

Recommendation:

- prefer creating new derived artifacts for new parser/render versions where needed
- keep raw source immutable

## 6. How Quickly Should We Add New Providers?

Recommendation:

- do not add a second provider until Claude Code import, rendering, and sync are stable
- design for multi-provider now, but earn it with one excellent adapter first

## Short Strategic Recommendation

Be ambitious in architecture, conservative in rollout.

That means:

- strong schema and package design now
- narrow first-wave implementation
- prove Claude Code end-to-end before expanding provider count or UI scope
