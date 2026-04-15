# API Contracts, Hono, OpenAPI, And Scalar

This document describes the recommended API stack.

## Recommendation

Use:

- Hono for the API framework
- Zod for validation
- `@hono/zod-openapi` for route contracts and OpenAPI generation
- Scalar for API reference UI

## Why This Fits HowiCC

The system needs strong contracts between:

- CLI
- API
- web app
- background jobs

The contract definitions should live in one package and generate shared types.

## Recommended Contract Package

Create `packages/contracts` with:

- request schemas
- response schemas
- public enums
- canonical and render schema versions
- route definitions

## Example Areas To Cover

- create upload session
- upload revision asset bytes
- finalize revision
- list user's conversations
- fetch current render document
- fetch artifact body
- publish or unpublish conversation
- create and revoke CLI API tokens

## Suggested Request Pattern

```ts
const UploadRevisionAssetRoute = createRoute({
  method: 'put',
  path: '/uploads/{uploadId}/assets/{kind}',
})

const FinalizeRevisionSchema = z.object({
  uploadId: z.string(),
  conversationId: z.string().optional(),
  sourceRevisionHash: z.string(),
  sourceApp: z.string(),
  sourceSessionId: z.string(),
  sourceProjectKey: z.string(),
  title: z.string(),
  assets: z.array(z.object({
    kind: z.enum(['source_bundle', 'canonical_json', 'render_json']),
    r2Key: z.string(),
    sha256: z.string(),
    bytes: z.number(),
  })),
})
```

In the implemented v1 path, `create upload session` returns API upload paths rather than signed R2 URLs.

That keeps the contract compatible with direct-to-R2 uploads later while letting the first production path validate and store bytes inside the API worker today.

## Why Scalar Is Useful

Scalar gives us a clean API reference experience that is easier to maintain than ad-hoc markdown docs.

That is especially valuable when the CLI and web app both depend on the same Hono routes.

## Contract Rules

1. Contracts live in `packages/contracts`, not inside one app.
2. The CLI imports those contracts for request typing.
3. The API validates against the same contracts at runtime.
4. OpenAPI is generated from the same source.
5. Scalar renders the docs from that OpenAPI output.

## Why This Matters For The Revamp

We are replacing a loosely shaped markdown upload contract with a structured revision upload protocol.

That contract should be explicit, versioned, and shared from day one.
