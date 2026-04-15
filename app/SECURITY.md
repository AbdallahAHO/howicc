# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

1. **Do NOT** open a public GitHub issue
2. Email security details to: security@howi.cc
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Disclosure Policy

- We will acknowledge receipt of your report within 48 hours
- We will provide a timeline for addressing the vulnerability
- We follow a **90-day disclosure window**:
  - After 90 days, or once a fix is available, we will disclose the vulnerability
  - If a fix is available before 90 days, we may disclose earlier
  - Critical vulnerabilities may be disclosed sooner if necessary

## Security Best Practices

### For Self-Hosters

1. **Never expose PocketBase directly** - Keep it on an internal network only
2. **Use strong credentials** - Generate secure API keys and admin passwords
3. **Keep dependencies updated** - Regularly run `pnpm audit` and update packages
4. **Use HTTPS** - Always use TLS in production
5. **Rotate tokens regularly** - Change API keys and admin credentials periodically
6. **Monitor logs** - Watch for suspicious activity

### For Developers

1. **Never commit secrets** - Use environment variables, never commit `.env` files
2. **Run security checks** - Use `pnpm check-secrets` before deploying
3. **Validate configuration** - Use `pnpm validate-config` to check settings
4. **Review dependencies** - Audit third-party packages regularly
5. **Follow secure defaults** - Use private visibility by default

## Security Features

- **Rate limiting** - API endpoints are rate-limited to prevent abuse
- **SSRF protection** - URL validation prevents server-side request forgery
- **XSS sanitization** - All user-generated content is sanitized
- **CORS protection** - Exact origin matching, no wildcards
- **Security headers** - CSP, HSTS, X-Frame-Options, and more
- **Private by default** - Conversations are private unless explicitly made public

## Known Limitations

- Rate limiting is in-memory (not distributed) - may not work across multiple instances
- SSRF protection relies on hostname validation - DNS resolution not checked
- Client bundle secret scanning is a best-effort check - may have false positives

## Security Updates

Security updates will be:

- Tagged with `[SECURITY]` in release notes
- Published as patch versions
- Backported to supported versions when possible

## Contact

For security concerns, email: **security@howi.cc**
