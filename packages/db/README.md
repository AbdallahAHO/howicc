# @howicc/db

Relational metadata schema and database adapter boundaries for HowiCC.

## What Belongs Here

- Drizzle schema definitions
- generated TypeScript types derived from tables
- Zod schemas derived from Drizzle tables
- adapter boundaries for D1 now and PostgreSQL later
- future query helpers and migration utilities

## Environment Contract

This package exports a package-owned env contract in `@howicc/db/keys`.

It currently defines:

- `DB_PROVIDER`
- `DATABASE_URL`

The package does not decide final runtime composition. Apps compose this preset in their own `env.ts`.

## Provider Config Resolution

This package also exports `resolveDatabaseProviderConfig()`.

That helper turns validated env values into a runtime-friendly provider config:

- `{ provider: 'd1' }`
- `{ provider: 'postgres', connectionString }`

Apps should use that helper in `runtime.ts` instead of duplicating provider-branching logic.

## What Stays Elsewhere

- blob storage logic for R2
- provider parsing
- frontend state and rendering

## Why This Package Exists

The new system stores metadata in D1 and large artifacts in R2.

This package keeps the relational model explicit and portable.

## Design Direction

The DB layer is intentionally split into:

- `schema/`
  - table definitions and enum value sources
- `types.ts`
  - TypeScript types inferred from Drizzle tables
- `zod.ts`
  - input/output schemas generated from the same table definitions
- `adapters/`
  - concrete runtime bindings such as D1 and Postgres

That means the product can start on D1 but change to Postgres later without redefining the whole domain schema.

## Pricing Catalog Persistence

This package now also defines relational tables for model catalog snapshots:

- `model_catalog_snapshots`
- `model_catalog_entries`

That gives us a place to persist:

- when a public pricing catalog was fetched
- which source hash it had
- how many models it contained
- the normalized per-model pricing rows

The raw JSON snapshot itself can live in object storage via `@howicc/storage` while the queryable metadata stays in the relational layer.
