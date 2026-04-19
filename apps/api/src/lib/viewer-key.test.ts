import { describe, expect, it } from 'vitest'
import { deriveViewerKey } from './viewer-key'

describe('deriveViewerKey', () => {
  const runtimeEnv = {
    BETTER_AUTH_SECRET: 'test-secret',
  }

  const createRequest = () =>
    new Request('http://localhost/test', {
      headers: {
        'user-agent': 'vitest-agent',
        'x-forwarded-for': '203.0.113.10',
      },
    })

  it('dedupes signed-in viewers by user id instead of shared device fingerprint', async () => {
    const request = createRequest()

    const first = await deriveViewerKey(request, runtimeEnv, 'user_1')
    const second = await deriveViewerKey(request, runtimeEnv, 'user_2')

    expect(first).not.toBe(second)
  })

  it('keeps anonymous viewers stable for the same request fingerprint', async () => {
    const first = await deriveViewerKey(createRequest(), runtimeEnv)
    const second = await deriveViewerKey(createRequest(), runtimeEnv)

    expect(first).toBe(second)
  })
})
