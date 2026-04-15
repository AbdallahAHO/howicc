# @howicc/contracts

Single source of truth for the HowiCC API surface.

## Responsibilities

- Hono route contracts
- request and response schemas
- public enums and shared API vocabulary
- `AppType` for typed Hono RPC clients

## What Stays Elsewhere

- route handlers and business logic
- database queries
- middleware
- provider parsing logic

## Contract Standards

1. Every public JSON endpoint should be represented here.
2. Contracts should describe the real runtime surface, not an aspirational future shape.
3. Shared enums and reusable schemas belong here when they are part of the public API language.
4. Schemas should be explicit enough to produce useful OpenAPI docs. Avoid `z.unknown()` unless the payload is intentionally opaque.
5. Auth expectations belong in the contract through OpenAPI security metadata and route descriptions.

## Current Public Surface

- `GET /health`
- `POST /cli-auth/authorize`
- `POST /cli-auth/exchange`
- `GET /cli-auth/whoami`
- `POST /uploads/sessions`
- `PUT /uploads/{uploadId}/assets/{kind}`
- `POST /uploads/finalize`
- `GET /conversations`
- `GET /conversations/{conversationId}/render`
- `GET /conversations/{conversationId}/artifacts/{artifactId}`
- `GET /pricing/models`
- `GET /profile`
- `POST /profile/recompute`
- `GET /repo/{owner}/{name}`
- `GET /viewer/session`
- `GET /viewer/protected`

## Why This Package Matters

This package keeps the contract shared between:

- `apps/api`
- `packages/api-client`
- the CLI
- the web app

It follows the strongest part of the `really-app` pattern: one public source of truth for route shapes, auth expectations, and downstream client types.
