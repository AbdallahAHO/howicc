# @howicc/api-client

Type-safe HTTP client for HowiCC, generated from the worker's OpenAPI document.

## What It Ships

- a generated OpenAPI snapshot at `openapi/howicc-openapi.json`
- generated request and schema types in `src/generated/openapi.ts`
- a thin `openapi-fetch` client with auth/header injection
- domain-oriented helpers for CLI, web, and scripts
- `openapi-react-query` integration for React apps
- error-state helpers backed by the shared API error catalog

## Why It Exists

The contract lives in `@howicc/contracts`, the worker exposes `/openapi.json`, and this package turns that into a client surface that stays aligned with the server. The goal is one typed source of truth for:

- the CLI
- the web app
- internal tooling
- future SDK-style integrations

## Generate The Client

```bash
pnpm --filter @howicc/api-client run generate
```

This does two things:

- requests the worker's live OpenAPI document from `createApp().request('/openapi.json')`
- regenerates the typed client and enums with `openapi-typescript`

To verify nothing drifted:

```bash
pnpm --filter @howicc/api-client run generate:check
```

## Domain Client

```ts
import { createApiClient } from '@howicc/api-client'

const api = createApiClient({
  baseUrl: 'https://api.howi.cc',
  getToken: async () => sessionStorage.getItem('token'),
})

const profile = await api.profile.get()
const conversations = await api.conversations.list()
```

The domain helpers keep common operations readable while still using the generated path and schema types under the hood.

## React Query

```ts
import { createApiQueryClient, createHowiccQueryClient } from '@howicc/api-client/query'
import { ApiPaths } from '@howicc/api-client'

const queryClient = createHowiccQueryClient()
const api = createApiQueryClient({
  baseUrl: 'https://api.howi.cc',
  getToken: async () => localStorage.getItem('token'),
})

const profileQuery = api.useQuery('get', ApiPaths.getProfile)
```

`createHowiccQueryClient()` applies the default retry policy for known retryable API errors, while `createApiQueryClient()` exposes the generated OpenAPI query hooks.

## Error Handling

```ts
import { deriveApiErrorRenderState, isApiErrorResponse } from '@howicc/api-client'
```

Error helpers are driven by the shared error catalog in `@howicc/contracts`, so frontend rendering logic can key off stable machine-readable codes instead of response strings.

## Generated Exports

The package re-exports the main generated enums and types for client-facing layers:

- `ApiPaths`
- `OpenApiErrorCode`
- `ConversationVisibility`
- `ProviderId`
- `UploadAssetKind`
- `components`
- `operations`
- `paths`
