# Platform Rebuild

This folder documents the backend and deployment reset for HowiCC.

The recommendation is to move away from PocketBase and rebuild around a Cloudflare-native platform with stronger boundaries:

- Astro for the website
- Hono for the API
- Drizzle as the schema and query layer
- D1 for metadata
- R2 for large artifacts
- Queues for asynchronous processing
- shared contracts for schemas and types

## Why Rebuild The Platform Too

The parser and data model are changing so much that keeping the old backend shape would force awkward compromises.

The new platform should be designed around:

- revisioned conversation imports
- canonical session storage
- render document delivery
- artifact lazy-loading
- privacy review workflows
- multi-provider support over time

## Document Map

### Platform foundations
- `01-cloudflare-architecture.md`
- `02-monorepo-structure.md`
- `03-data-model-d1-r2.md`
- `04-api-contracts-hono-openapi.md`
- `05-auth-tokens-and-clients.md`
- `06-processing-observability-and-operations.md`
- `07-deployment-and-ci-cd.md`
- `08-migration-plan.md`
- `09-package-blueprints.md`
- `10-quality-gates-and-test-strategy.md`
- `11-execution-roadmap.md`
- `12-risks-and-open-questions.md`
- `13-environment-and-runtime-configuration.md`

### Live status
- `21-implementation-status.md` — **the audit.** What's built, what's missing,
  current critical-path blockers for the sharing loop. Read this first; it
  reconciles docs 17, 18, and 20 with the actual `apps/web/` and `apps/api/`
  surface.
- `22-block-ui-kit.md` — per-block UI kit spec (one component per render
  block type, atomic primitives, exhaustive dispatcher).

### Product and UX
- `14-repositories-and-project-grouping.md` — repo grouping data model
- `15-jtbd-ux-flows-and-user-journey.md` — user journey CLI → shared session
- `16-team-access-and-github-integration.md` — GitHub-gated team access
- `17-web-app-pages-and-screens.md` — page inventory and ASCII wireframes
- `18-data-and-api-per-page.md` — data/API contracts for each page
- `19-developer-brutalism-prd.md` — **(archived)** dark terminal aesthetic
- `20-design-md-the-archive.md` — **canonical** warm Claude-style design system

### Design direction

The canonical visual design for the web app is **The Archive** (doc 20) — a
warm, editorial, Claude-aesthetic system with cream backgrounds, serif page
titles, sentence-case UI, soft rounded corners, and timeline components.

Doc 19 (Developer Brutalism) is preserved as an alternative direction and as
inspiration for the CLI's terminal output styling, but the web app follows
doc 20.

**When designing a page:** reference doc 17 for the wireframe and information
hierarchy, doc 18 for the data contract, and doc 20 for the visual system.
