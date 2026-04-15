# @howicc/storage

Provider-neutral storage interfaces and adapters for HowiCC.

## What Belongs Here

- storage operation types
- storage path/key-building helpers
- storage adapter interfaces
- concrete providers such as Cloudflare R2 and S3-compatible storage

## Environment Contract

This package exports a package-owned env contract in `@howicc/storage/keys`.

It currently defines:

- `STORAGE_PROVIDER`
- `STORAGE_BUCKET_NAME`
- `STORAGE_REGION`
- `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`

The storage key/path helpers are exported separately from `@howicc/storage/paths`.

## Provider Config Resolution

This package also exports `resolveStorageProviderConfig()`.

That helper turns validated env values into a runtime-friendly provider config:

- `{ provider: 'r2' }`
- `{ provider: 's3-compatible', bucketName, region, ... }`

Apps should use that helper in `runtime.ts` rather than manually branching on storage provider strings.

## What Stays Elsewhere

- conversation metadata in the relational DB
- provider transcript parsing
- API route handlers

## Why This Package Exists

HowiCC stores large artifacts separately from metadata.

That includes:

- source bundles
- canonical session JSON
- render document JSON
- large tool outputs

The system is starting with Cloudflare R2, but the interface should not assume R2 forever. This package makes that boundary explicit.

## Pricing Catalog Snapshots

This package also owns storage key helpers for non-conversation assets such as model catalog snapshots.

Example:

- `buildModelCatalogSnapshotKey(provider, snapshotId)`

That lets the API persist raw catalog payloads in object storage while keeping the relational metadata in `@howicc/db`.

## Design Direction

- `keys.ts` owns storage env contracts
- `paths.ts` owns stable storage key conventions
- `adapters/` owns provider implementations
- `StorageAdapter` is the provider-neutral surface the API and jobs should depend on

That keeps the platform free to move from R2 to another object store later if needed.
