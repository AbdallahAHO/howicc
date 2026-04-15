# Threat Model

## Overview

This document outlines the security threats and mitigations for howi.cc.

## Architecture

- **Astro App**: Public-facing SSR application (port 4321)
- **PocketBase**: Internal database (port 8090, not exposed)
- **Client**: Browser (no direct PocketBase access)

## Threat Vectors

### 1. Admin Token Exposure

**Threat**: Admin credentials (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`) exposed in client bundle or logs.

**Mitigation**:

- Admin credentials only used server-side
- Never exposed via `PUBLIC_*` env vars
- CI check scans client bundle for secrets
- Config validation warns if `PB_URL` is set to a public URL

**Risk Level**: 🔴 High

### 2. PocketBase Rules Bypass

**Threat**: Anonymous users can list private conversations or access unlisted content.

**Mitigation**:

- `listRule`: `(visibility='public' && allowListing=true) || user=@request.auth.id` (denies anonymous list)
- `viewRule`: Allows unlisted view (by design, for link sharing)
- All operations go through Astro SSR API (not direct PB access)
- Ownership checks in API endpoints

**Risk Level**: 🟡 Medium

### 3. SSRF (Server-Side Request Forgery)

**Threat**: Malicious URLs in file fetches could access internal services.

**Mitigation**:

- URL validation in `ssrf-protection.ts`
- Rejects RFC1918, loopback, link-local addresses
- Only allows PocketBase file URLs (validated against `PB_URL`)
- Timeout on fetch requests (5s default)

**Risk Level**: 🟡 Medium

### 4. XSS (Cross-Site Scripting)

**Threat**: User-generated markdown could contain malicious JavaScript.

**Mitigation**:

- DOMPurify sanitization of all HTML output
- Allowlist approach (only safe tags/attributes)
- CSP header: `default-src 'self'; object-src 'none'`
- No `unsafe-inline` for scripts (only styles)

**Risk Level**: 🟡 Medium

### 5. IDOR (Insecure Direct Object Reference)

**Threat**: Users could access/modify conversations they don't own.

**Mitigation**:

- Ownership checks in all API endpoints (`/api/publish`, `/api/conversations`)
- PocketBase rules enforce `user=@request.auth.id` for create/update/delete
- API key validation before any operation

**Risk Level**: 🟡 Medium

### 6. Rate Limiting Bypass

**Threat**: Brute force attacks on API endpoints or slug enumeration.

**Mitigation**:

- In-memory rate limiting per IP
- Different limits for different endpoints:
  - Upload: 10/min
  - Publish: 20/min
  - Ingest: 5/min
  - 404s: 50/min (slug brute force protection)

**Risk Level**: 🟢 Low

### 7. CORS Misconfiguration

**Threat**: Wildcard CORS allows any origin to access API.

**Mitigation**:

- Exact origin matching (not `*`)
- CORS origin from `PUBLIC_SITE_URL` env var
- Config validation warns if CORS is wildcard in production

**Risk Level**: 🟡 Medium

### 8. Supply Chain Attacks

**Threat**: Malicious packages in dependencies.

**Mitigation**:

- Lockfile pinned (`pnpm-lock.yaml`)
- Regular `pnpm audit` checks
- CI checks for known vulnerabilities
- Minimal dependencies

**Risk Level**: 🟡 Medium

### 9. Config Drift

**Threat**: Self-host installs diverge from secure defaults.

**Mitigation**:

- Secure defaults in code (private visibility, `allowListing=false`)
- Docker Compose example with secure defaults
- Documentation warnings about exposing PocketBase
- Config validation script

**Risk Level**: 🟢 Low

### 10. Secrets in Client Bundle

**Threat**: Environment variables with secrets leaked to client.

**Mitigation**:

- Only `PUBLIC_*` vars exposed to client
- CI check scans client bundle for `TOKEN`, `KEY`, `SECRET` patterns
- Build fails if secrets found

**Risk Level**: 🔴 High

## Security Controls Summary

| Control                | Status | Notes                    |
| ---------------------- | ------ | ------------------------ |
| Admin token protection | ✅     | Server-side only         |
| PocketBase rules       | ✅     | Deny anonymous list      |
| SSRF protection        | ✅     | URL validation + timeout |
| XSS sanitization       | ✅     | DOMPurify allowlist      |
| IDOR protection        | ✅     | Ownership checks         |
| Rate limiting          | ✅     | Per-IP, per-endpoint     |
| CORS protection        | ✅     | Exact origin matching    |
| Security headers       | ✅     | CSP, HSTS, etc.          |
| Secret scanning        | ✅     | CI check                 |
| Config validation      | ✅     | Boot-time checks         |

## Assumptions

1. PocketBase is on internal network (not exposed to internet)
2. Admin credentials are kept secure (not in version control)
3. Self-hosters follow deployment documentation
4. HTTPS is used in production (TLS termination at proxy/load balancer)

## Future Improvements

- [ ] Distributed rate limiting (Redis)
- [ ] DNS resolution check for SSRF protection
- [ ] Automated dependency scanning in CI
- [ ] Security audit logging
- [ ] WAF integration for production deployments
