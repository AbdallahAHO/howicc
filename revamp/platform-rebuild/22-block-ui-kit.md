# Block UI Kit

**Last updated:** 2026-04-18
**Lives in:** `apps/web/src/components/blocks/`
**Contract:** `@howicc/contracts` (source of truth — never redeclare block shapes)

The kit is a one-to-one mapping of render-document block types to isolated
UI components. Each block type owns its own file. Composition happens in
the `BlockRenderer` dispatcher; the block components themselves never know
about each other (exception: `BlockSubagentThread` recurses through the
dispatcher).

This doc is the durable spec. See doc 21 for implementation status per
wave.

---

## Principles

1. **Typed from the contract.** Every prop is `z.infer<typeof renderXxxBlockSchema>`
   via a `Render*Block` named export. If the contract changes, the build
   breaks until markup follows.
2. **One block = one component.** Never fan out responsibilities across
   files.
3. **Atomic primitives carry the design language.** Restyling
   `BlockShell` / `CollapsibleBlockShell` / `BlockHeader` restyles every
   block at once.
4. **Progressive disclosure via native `<details>`.** Zero JS unless the
   interaction demands it (the kit has one island: `CopyButtonIsland`).
5. **Semantic HTML, accessible by default.** `<article>` for messages,
   `<section>` for grouped items, `<details>` for collapsibles,
   `role="list"` on every `<ul>/<ol>`.
6. **Theme tokens only.** No raw hex, no Tailwind colors outside the
   design system. Dark-mode safe by default.
7. **Voice: sentence case, natural outcomes.** No `[STATUS]` brackets.

---

## Folder layout

```
apps/web/src/components/blocks/
├── shared/
│   ├── BlockShell.astro              — outer article, tone-aware
│   ├── CollapsibleBlockShell.astro   — <details>/summary wrapper
│   ├── BlockHeader.astro             — eyebrow + title + meta + action
│   ├── StatusPill.astro              — ok / error / partial
│   ├── TonePill.astro                — info / warning / error
│   ├── MonoChip.astro                — inline monospace label
│   ├── ToolRunPreview.astro          — code block with copy action
│   ├── TimelineRail.astro            — vertical connector
│   ├── JsonPreview.astro             — structured-data renderer
│   ├── AttachmentChip.astro          — brief-delivery attachment
│   └── CopyButtonIsland.tsx          — sole interactive primitive
├── BlockMessage.astro
├── BlockActivityGroup.astro
├── BlockActivityGroup.ToolRun.astro
├── BlockActivityGroup.HookEvent.astro
├── BlockCallout.astro
├── BlockTodoSnapshot.astro
├── BlockQuestion.astro
├── BlockTaskTimeline.astro
├── BlockResource.astro
├── BlockStructuredData.astro
├── BlockBriefDelivery.astro
├── BlockSubagentThread.astro
├── BlockCompactBoundary.astro
├── BlockRenderer.astro               — dispatcher, exhaustive switch
└── index.ts                          — barrel
```

---

## Contract type exports

`packages/contracts/src/shared.ts` promotes each block schema to `export`
and ships a matching inferred type alias. Consumers import the type:

```ts
import type {
  RenderBlock,
  RenderMessageBlock,
  RenderActivityGroupBlock,
  RenderToolRunActivity,
  RenderHookActivity,
  RenderCalloutBlock,
  RenderTodoSnapshotBlock,
  RenderQuestionBlock,
  RenderTaskTimelineBlock,
  RenderResourceBlock,
  RenderStructuredDataBlock,
  RenderBriefDeliveryBlock,
  RenderSubagentThreadBlock,
  RenderCompactBoundaryBlock,
} from '@howicc/contracts'
```

The union `RenderBlock` is the discriminated input to `BlockRenderer`;
each component's prop type is the narrow member.

### Subagent recursion

`subagentThreadBlockSchema` carries `blocks: z.array(z.unknown())` to avoid
a circular zod definition. In TypeScript we narrow it at the component
boundary:

```ts
const children = block.blocks as RenderBlock[]
```

This is the only place in the kit that casts. Centralised inside
`BlockSubagentThread` so callers never need to think about it.

---

## Component inventory

| Block type | Component | Collapsible | Variants |
|---|---|---|---|
| `message` | BlockMessage | no | user / assistant |
| `activity_group` | BlockActivityGroup | yes | — |
| — item `tool_run` | BlockActivityGroup.ToolRun | inline | ok / error / partial; native / mcp |
| — item `hook_event` | BlockActivityGroup.HookEvent | inline | info / warning / error |
| `callout` | BlockCallout | no | info / warning / error |
| `todo_snapshot` | BlockTodoSnapshot | yes | — |
| `question` | BlockQuestion | yes | answered / declined / redirected / finished_plan_interview |
| `task_timeline` | BlockTaskTimeline | yes | status per entry |
| `resource` | BlockResource | yes | with / without preview |
| `structured_data` | BlockStructuredData | yes | flat / nested |
| `brief_delivery` | BlockBriefDelivery | yes | with / without attachments |
| `subagent_thread` | BlockSubagentThread | yes | depth-aware (1, 2+) |
| `compact_boundary` | BlockCompactBoundary | no | — |

---

## Dispatcher contract

```astro
---
import type { RenderBlock } from '@howicc/contracts'

type Props = { blocks: RenderBlock[]; depth?: number }

const { blocks, depth = 0 } = Astro.props
---
```

Switch on `block.type` with an exhaustiveness `never` default: the
compiler fails a build when a new block type is added to the union until
we add its matching case.

---

## Atomic primitive specs

### BlockShell

```astro
Props: {
  tone?: 'default' | 'muted' | 'subagent'
  depth?: number     // 0 (top), 1, 2+ — drives subagent tonal lift
  class?: string
}
```

- `<article class="rounded-xl border border-border/60 bg-background p-4 sm:p-5">`
- `tone="muted"` → `bg-muted/30`
- `tone="subagent"` + `depth=1` → `bg-muted/40 border-border`; `depth=2+` clamps at same.

### CollapsibleBlockShell

```astro
Props: { defaultOpen: boolean; tone?: 'default' | 'muted' }
Slots:  default (body), summary (header)
```

- `<details open={defaultOpen} class="rounded-xl border border-border/60 bg-muted/20">`
- `<summary>` with `cursor-pointer list-none` and a built-in expand chevron
  (via `[&::-webkit-details-marker]:hidden` + a rotating chevron icon via CSS).

### BlockHeader

```astro
Props: {
  eyebrow?: string
  title: string
  meta?: string
  count?: number
}
Slots: action (right-side action)
```

- Flex row. Title is `text-sm font-medium` (never `font-bold`).
- Count renders as an outline Badge on the right.

### StatusPill, TonePill, MonoChip

- All thin wrappers over shadcn `Badge` with a deterministic variant.
- `MonoChip` is a plain `<code>` with `bg-muted rounded px-1 py-0.5 font-mono text-xs` for inline labels (tool names, server names, hashes).

### ToolRunPreview

```astro
Props: {
  label: 'input' | 'output'
  body: string
  maxChars?: number     // default 400 input, 600 output
  language?: string     // reserved for future syntax highlighting
}
```

- Soft `bg-muted/50` for input, bordered `bg-background` for output.
- Truncated with `…` when over `maxChars`.
- Renders `CopyButtonIsland` in the top-right corner (single island for the whole kit).

### TimelineRail

- Shared vertical connector used by `BlockTaskTimeline` and later by the
  phase spine once we unify them.

---

## How pages consume the kit

```astro
import BlockRenderer from '../components/blocks/BlockRenderer.astro'

<BlockRenderer blocks={doc.blocks} />
```

The consumer never imports individual block components — always the
dispatcher. Tests verify that an unknown block type renders as
`<UnknownBlock>` without crashing, and that the `never` exhaustiveness
check fires at compile time when a new block type is added to the union.

---

## Wave plan (implementation order)

1. **Wave 1** — named contract exports + primitives + dispatcher + unknown fallback.
2. **Wave 2** — message, activity_group (+ tool_run, hook_event children), callout, compact_boundary. Swap `/s/:slug` to the dispatcher. Delete legacy `components/session/RenderBlocks.astro`.
3. **Wave 3** — todo_snapshot, question, task_timeline.
4. **Wave 4** — resource, structured_data, brief_delivery.
5. **Wave 5** — subagent_thread with depth-aware tonal lift ✓ (shipped with the kit). Artifact drilldown wired via `ArtifactDrawerIsland` in `shared/` ✓ — tool runs with an `artifactId` render an inline disclosure that fetches `GET /conversations/:id/artifacts/:id` on first open and caches the response in component state for subsequent toggles. Resource-block `assetId` still waits on a dedicated resource-asset endpoint — flagged in `BlockResource.astro` with an explicit reason so future readers aren't surprised.

---

## What the kit does NOT do

- No syntax highlighting in v1. `ToolRunPreview` reserves a `language` prop
  for future integration (Shiki) but renders plain monospace today.
- No virtualisation. A session with ~500 blocks renders fine as HTML; if
  we hit real scaling pain, we'll add windowing inside `BlockRenderer`.
- No inline diff rendering for write tools. Input shows the patch text
  in its raw form; a dedicated diff viewer comes in a later wave.
- No comment/reactions affordances. The kit is read-only; social layers
  live above it.

---

## Cross-references

- Block type definitions: `packages/render/src/block.ts`.
- OpenAPI contract: `packages/contracts/src/shared.ts`.
- Page integration: `apps/web/src/pages/s/[slug].astro`.
- Phase grouping: `apps/web/src/components/session/classifyPhases.ts`.
- Live status board: `revamp/platform-rebuild/21-implementation-status.md`.
