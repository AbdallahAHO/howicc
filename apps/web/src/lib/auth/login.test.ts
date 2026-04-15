import { describe, expect, it } from 'vitest'
import { resolveLoginCallbackUrl } from './login'

describe('resolveLoginCallbackUrl', () => {
  it('preserves a local returnTo path and query string', () => {
    expect(
      resolveLoginCallbackUrl({
        siteUrl: 'http://localhost:4321',
        requestedReturnTo: '/cli/login?callbackUrl=http%3A%2F%2F127.0.0.1%3A8787%2Fcallback',
      }),
    ).toBe(
      'http://localhost:4321/cli/login?callbackUrl=http%3A%2F%2F127.0.0.1%3A8787%2Fcallback',
    )
  })

  it('falls back to the site root for external returnTo values', () => {
    expect(
      resolveLoginCallbackUrl({
        siteUrl: 'https://howi.cc',
        requestedReturnTo: 'https://evil.example.com/steal-session',
      }),
    ).toBe('https://howi.cc/')
  })
})
