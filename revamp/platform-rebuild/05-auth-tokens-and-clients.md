# Auth, Tokens, And Clients

This document recommends how authentication should work in the new platform.

## Recommendation

Use GitHub OAuth for the web app and issue API tokens for the CLI.

Recommended implementation direction:

- Better Auth or Auth.js
- user, account, and session records stored in D1

## Why Not Keep Auth Mixed Into A Generic Backend

The new system needs clean ownership of:

- users
- sessions
- CLI tokens
- publish permissions
- private versus public access

That maps well to a dedicated auth layer inside the new platform.

## Web Auth Flow

```text
user opens app
-> GitHub OAuth
-> app creates or updates user/account/session rows
-> authenticated settings area
```

## CLI Auth Flow

Recommended first version:

```text
user logs into website
-> user creates CLI token
-> CLI stores token locally
-> CLI uses Bearer token for sync APIs
```

This is simpler and more reliable than trying to make the CLI own OAuth flows immediately.

## API Tokens

Suggested table fields:

- `id`
- `user_id`
- `name`
- `token_prefix`
- `token_hash`
- `created_at`
- `last_used_at`
- `revoked_at`

Store only the token hash, not the raw token.

## Client Types

### Web Client

- cookie or session-based auth
- used for settings, drafts, publish controls

### CLI Client

- bearer token auth
- used for upload session creation and finalize calls

### Public Client

- no auth for public or unlisted pages
- read-only render document and artifact access, subject to visibility rules

## Access Rules

At minimum:

- only owners can upload revisions to their conversations
- only owners can access private conversation metadata
- public and unlisted content should resolve through the current revision pointer
- artifact access should enforce the same visibility rules as the conversation page
