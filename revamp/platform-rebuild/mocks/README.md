# API Response Mocks

Real JSON responses from the local API + generated mocks for planned endpoints.
Use these to build a functional prototype for the web app without needing a
live backend.

All data is from **Abdallah's real Claude Code sessions** synced to a local
Cloudflare Workers dev instance, so the shapes, field names, and distributions
are realistic. The checked-in mock files are sanitized for secrets, local paths,
and direct personal identifiers.

## How These Were Generated

1. `apps/api` was run via `pnpm dev` (Wrangler local, port 8787)
2. A small batch of recent Claude Code sessions was synced via
   `howicc sync --force --limit 8`
3. The API endpoints that exist today were captured with `curl`
4. The planned endpoints (doc 18) were generated via a Python script that reads
   the same D1 database and produces the shapes specified in doc 18

## Files

### Implemented endpoints (live API capture)

| File | Endpoint | Status |
|------|----------|--------|
| `GET__health.json` | `GET /health` | Live |
| `GET__cli-auth__whoami.json` | `GET /cli-auth/whoami` | Live |
| `GET__conversations.json` | `GET /conversations` | Live |
| `GET__conversations__CONV_ID__render.json` | `GET /conversations/:id/render` (small) | Live |
| `GET__conversations__CONV_ID__render__large.json` | `GET /conversations/:id/render` (large) | Live |
| `GET__profile.json` | `GET /profile` | Live |
| `GET__pricing__models.json` | `GET /pricing/models` | Live (OpenRouter proxy) |
| `GET__repo__axetay__really-app.json` | `GET /repo/:owner/:name` (empty result) | Live |
| `GET__repo__personal__howicc.json` | `GET /repo/:owner/:name` (with data) | Live |

### Planned endpoints (generated from real data)

These endpoints don't exist yet in the API but the shapes are realistic because
they're derived from the same D1 data.

| File | Endpoint | Nature |
|------|----------|--------|
| `GET__profile__stats.json` | `GET /profile/stats` | Generated |
| `GET__profile__activity.json` | `GET /profile/activity?limit=20` | Generated |
| `GET__profile__public__abdallah.json` | `GET /profile/public/:username` | Generated |
| `GET__conversations__conv_*.json` | `GET /conversations/:id` (full metadata) | Generated |
| `GET__conversations__conv_*__digest.json` | `GET /conversations/:id/digest` | Generated |
| `GET__shared__*.json` | `GET /shared/:slug` (public, no auth) | Generated |
| `GET__repos.json` | `GET /repos` (list user repos) | Generated |
| `GET__api-tokens.json` | `GET /api-tokens` | Generated |

## Data Characteristics

**User:** Abdallah Othman (`user_demo_01`)
**Snapshot size:** 9 digests across 9 sessions
**Repositories:** axetay/really-app, personal/howicc, feature/rel-217-chat, Users/abdallah
**Session types:** 1 exploring, 1 investigating, 7 mixed
**Primary language:** TypeScript (207 files), Markdown (61), JSON (7)
**Total tool runs:** 1,294 across 9 digests
**Total cost:** ~$320
**Total duration:** ~12 hours

The data is heavily weighted toward the howicc project and the `chore/howicc-
revamp-foundation` branch because those are the most recently worked sessions.

## Using These Mocks In a Prototype

### With a static file server

```bash
cd revamp/platform-rebuild/mocks/api-responses
python3 -m http.server 9000
# Then fetch http://localhost:9000/GET__profile.json from your prototype
```

### With MSW (Mock Service Worker)

```ts
import { http, HttpResponse } from 'msw'
import profileStats from './mocks/api-responses/GET__profile__stats.json'
import profileActivity from './mocks/api-responses/GET__profile__activity.json'

export const handlers = [
  http.get('/profile/stats', () => HttpResponse.json(profileStats)),
  http.get('/profile/activity', () => HttpResponse.json(profileActivity)),
  http.get('/profile/public/:username', () => HttpResponse.json(profilePublic)),
  // ... etc
]
```

### With a fetch wrapper

```ts
const MOCK_BASE = '/mocks/api-responses'

async function fetchMock(path: string) {
  const filename = `GET${path.replace(/\//g, '__')}.json`
  const res = await fetch(`${MOCK_BASE}/${filename}`)
  return res.json()
}
```

## Regenerating Mocks

To re-sync fresh data and regenerate mocks:

```bash
# 1. Reset local D1
cd apps/api && pnpm db:prepare:local && cd ../..

# 2. Start wrangler dev
cd apps/api && pnpm dev &
cd ../..

# 3. Seed your user + token (replace with your own token hash)
export HOWICC_MOCK_TOKEN="hwi_YOUR_TOKEN"
REAL_HASH=$(printf "%s" "$HOWICC_MOCK_TOKEN" | shasum -a 256 | awk '{print $1}')
cd apps/api && pnpm exec wrangler d1 execute DB --local --config wrangler.jsonc --command "INSERT INTO users (...) VALUES (...); INSERT INTO api_tokens (...) VALUES ('..', 'your-user-id', '$REAL_HASH', ...)"

# 4. Sync real sessions
HOWICC_API_URL=http://localhost:8787 node apps/cli/dist/index.cjs sync --force --limit 8

# 5. Capture responses + generate planned mocks
./revamp/platform-rebuild/mocks/capture-mocks.sh
./revamp/platform-rebuild/mocks/generate-planned-mocks.sh
```

## Notes On Realism

- **Render documents** (the conversation block list) are REAL — pulled from
  R2, decompressed, and rendered through the full canonical → render pipeline.
- **Profile data** (stats, projects, productivity) is REAL — computed by the
  actual `@howicc/profile` aggregator from 9 real session digests.
- **Session digests** are REAL — extracted during the real upload finalize.
- **Pricing models** (`GET /pricing/models`) is a live proxy to OpenRouter and
  returns ~350 real models with real pricing.
- **Public profile, activity feed, per-conversation metadata** are **generated**
  from the same real data using shapes specified in doc 18. When the endpoints
  are implemented for real, the responses will look very similar.

## Endpoint Coverage vs Doc 18

From the doc 18 endpoint list, this mock set covers:

```
✓  GET /health
✓  GET /cli-auth/whoami
✓  GET /conversations
✓  GET /conversations/:id/render
✓  GET /profile
✓  GET /pricing/models
✓  GET /repo/:owner/:name
◐  GET /profile/stats               (generated — endpoint not implemented)
◐  GET /profile/activity            (generated — endpoint not implemented)
◐  GET /profile/public/:username    (generated — endpoint not implemented)
◐  GET /conversations/:id           (generated — endpoint not implemented)
◐  GET /conversations/:id/digest    (generated — endpoint not implemented)
◐  GET /shared/:slug                (generated — endpoint not implemented)
◐  GET /repos                       (generated — endpoint not implemented)
◐  GET /api-tokens                  (generated — endpoint not implemented)

Not yet captured:
-  GET /conversations/:id/artifacts/:artifactId    (requires artifact lookup)
-  PATCH /conversations/:id/visibility             (write endpoint, no GET)
-  POST /api-tokens                                (write endpoint, no GET)
-  DELETE /api-tokens/:id                          (write endpoint, no GET)
-  POST /cli-auth/authorize                        (flow endpoint)
-  POST /cli-auth/exchange                         (flow endpoint)
-  PATCH /repos/:owner/:name/visibility            (write endpoint)
-  PATCH /repos/:owner/:name/conversations/:id/repo-visibility  (write)
-  GET /og/profile/:username.png                   (image endpoint)
-  POST /sessions/:id/view                         (fire-and-forget)
```

Write endpoints don't need response mocks — they return `{success: true}` with
the updated resource. The UX designer can stub these locally in the prototype.

## Companion Docs

- [doc 18 — data and API reference](../18-data-and-api-per-page.md) — the
  canonical contract for each endpoint
- [doc 17 — web app pages and screens](../17-web-app-pages-and-screens.md) —
  which endpoints each page uses
- [doc 20 — The Archive design system](../20-design-md-the-archive.md) — how
  to render the data visually
