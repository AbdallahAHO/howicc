import { afterEach, describe, expect, it } from 'vitest'
import { createCliAuthBridge, type CliAuthBridge } from './auth-bridge'

const activeBridges = new Set<CliAuthBridge>()

afterEach(async () => {
  await Promise.all(
    [...activeBridges].map(async bridge => {
      activeBridges.delete(bridge)
      await bridge.close()
    }),
  )
})

const createBridge = async () => {
  const bridge = await createCliAuthBridge()
  activeBridges.add(bridge)
  return bridge
}

describe('createCliAuthBridge', () => {
  it('resolves when the callback returns the expected code and state', async () => {
    const bridge = await createBridge()

    const callbackResponse = await fetch(
      `${bridge.callbackUrl}?code=auth-code&state=${bridge.state}`,
    )

    expect(callbackResponse.status).toBe(200)
    await expect(bridge.waitForCode(50)).resolves.toBe('auth-code')
  })

  it('rejects when the callback state does not match', async () => {
    const bridge = await createBridge()
    const codePromise = bridge.waitForCode(50)
    void codePromise.catch(() => {})

    const callbackResponse = await fetch(
      `${bridge.callbackUrl}?code=auth-code&state=wrong-state`,
    )

    expect(callbackResponse.status).toBe(400)
    await expect(codePromise).rejects.toThrow(
      'CLI login returned an invalid state or missing code.',
    )
  })

  it('rejects when the browser flow returns an explicit error', async () => {
    const bridge = await createBridge()
    const codePromise = bridge.waitForCode(50)
    void codePromise.catch(() => {})

    const callbackResponse = await fetch(
      `${bridge.callbackUrl}?error=access_denied&state=${bridge.state}`,
    )

    expect(callbackResponse.status).toBe(400)
    await expect(codePromise).rejects.toThrow(
      'CLI login failed: access_denied',
    )
  })

  it('times out when no browser callback arrives', async () => {
    const bridge = await createBridge()

    await expect(bridge.waitForCode(20)).rejects.toThrow(
      'Timed out waiting for browser authentication to complete.',
    )
  })
})
