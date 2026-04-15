import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeContext = vi.hoisted(() => ({
  cwd: '',
  projectName: 'howicc-cli-auth-command-test',
}))

const mocks = vi.hoisted(() => ({
  createCliApiClient: vi.fn(),
  createCliAuthBridge: vi.fn(),
  openExternalUrl: vi.fn(),
  healthCheck: vi.fn(),
  exchange: vi.fn(),
  whoami: vi.fn(),
  bridgeWaitForCode: vi.fn(),
  bridgeClose: vi.fn(),
}))

vi.mock('../config/store', async () => {
  const actual = await vi.importActual<typeof import('../config/store')>('../config/store')

  return {
    ...actual,
    CliConfigStore: class extends actual.CliConfigStore {
      constructor() {
        super({
          cwd: storeContext.cwd,
          projectName: storeContext.projectName,
          projectSuffix: '',
        })
      }
    },
  }
})

vi.mock('../lib/api', () => ({
  createCliApiClient: mocks.createCliApiClient,
}))

vi.mock('../lib/auth-bridge', () => ({
  createCliAuthBridge: mocks.createCliAuthBridge,
}))

vi.mock('../lib/browser', () => ({
  openExternalUrl: mocks.openExternalUrl,
}))

const { CliConfigStore } = await import('../config/store')
const { loginCommand, logoutCommand, whoamiCommand } = await import('./login')

describe('auth commands', () => {
  const tempDirectories: string[] = []
  let stdout: string[]
  let stderr: string[]

  beforeEach(async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-auth-command-'))
    tempDirectories.push(cwd)
    storeContext.cwd = cwd

    stdout = []
    stderr = []

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'))
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      stdout.push(args.join(' '))
    })
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      stderr.push(args.join(' '))
    })

    mocks.createCliApiClient.mockReturnValue({
      health: {
        check: mocks.healthCheck,
      },
      cliAuth: {
        exchange: mocks.exchange,
        whoami: mocks.whoami,
      },
    })
    mocks.createCliAuthBridge.mockResolvedValue({
      callbackUrl: 'http://127.0.0.1:4111/callback',
      state: 'state_123',
      codeChallenge: 'challenge_123',
      codeVerifier: 'verifier_123',
      waitForCode: mocks.bridgeWaitForCode,
      close: mocks.bridgeClose,
    })
    mocks.openExternalUrl.mockResolvedValue(undefined)
    mocks.healthCheck.mockResolvedValue({ success: true, status: 'ok' })
    mocks.bridgeWaitForCode.mockResolvedValue('grant_code_123')
    mocks.bridgeClose.mockResolvedValue(undefined)
    mocks.exchange.mockResolvedValue({
      success: true,
      token: 'hwi_test_token',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    mocks.whoami.mockResolvedValue({
      success: true,
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()

    await Promise.all(
      tempDirectories.splice(0).map(directory =>
        rm(directory, { recursive: true, force: true }),
      ),
    )
  })

  it('completes login, persists the token, and verifies the stored auth state', async () => {
    await loginCommand()

    expect(mocks.openExternalUrl).toHaveBeenCalledTimes(1)
    const openedUrl = new URL(mocks.openExternalUrl.mock.calls[0]?.[0] as string)

    expect(openedUrl.pathname).toBe('/cli/login')
    expect(openedUrl.searchParams.get('callbackUrl')).toBe('http://127.0.0.1:4111/callback')
    expect(openedUrl.searchParams.get('state')).toBe('state_123')
    expect(openedUrl.searchParams.get('codeChallenge')).toBe('challenge_123')
    expect(mocks.exchange).toHaveBeenCalledWith({
      code: 'grant_code_123',
      codeVerifier: 'verifier_123',
    })
    expect(mocks.bridgeClose).toHaveBeenCalledTimes(1)

    const store = new CliConfigStore()

    expect(store.getAuthToken()).toBe('hwi_test_token')
    expect(store.getAll().authUserEmail).toBe('abdallah@example.com')

    const output = stdout.join('\n')

    expect(output).toContain('HowiCC CLI Login')
    expect(output).toContain('API is reachable')
    expect(output).toContain('Opened the web login flow in your browser.')
    expect(output).toContain('Waiting for browser authentication to complete...')
    expect(output).toContain('Signed in as abdallah@example.com')
    expect(output).toContain('Run `howicc whoami` any time')
    expect(stderr).toEqual([])
  })

  it('falls back to manual browser login when automatic launch fails', async () => {
    mocks.openExternalUrl.mockRejectedValue(new Error('browser failed'))

    await loginCommand()

    const output = stdout.join('\n')

    expect(output).toContain('Automatic browser launch failed.')
    expect(output).toContain('Signed in as abdallah@example.com')
    expect(stderr).toEqual([])
  })

  it('clears the stored token when verification fails after exchange', async () => {
    mocks.whoami.mockResolvedValue({
      success: false,
      code: 'cli_token_invalid',
      error: 'The stored CLI token could not be verified.',
    })

    await expect(loginCommand()).rejects.toThrow(
      'The stored CLI token could not be verified.',
    )

    const store = new CliConfigStore()

    expect(store.getAuthToken()).toBeUndefined()
    expect(mocks.bridgeClose).toHaveBeenCalledTimes(1)
  })

  it('shows empty auth state and a login hint when no token is configured', async () => {
    await whoamiCommand()

    expect(mocks.healthCheck).toHaveBeenCalledTimes(1)
    expect(mocks.whoami).toHaveBeenCalledTimes(0)

    const output = stdout.join('\n')

    expect(output).toContain('HowiCC CLI Auth State')
    expect(output).toContain('Auth token   not configured')
    expect(output).toContain('Stored user  unknown')
    expect(output).toContain('Last login   never')
    expect(output).toContain('API health   ok')
    expect(output).toContain('Run `howicc login` to start the browser-based CLI auth flow.')
  })

  it('verifies the configured token against the API when one is stored', async () => {
    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test_token',
      user: {
        id: 'user_123',
        email: 'stored@example.com',
        name: 'Stored User',
      },
    })

    await whoamiCommand()

    expect(mocks.whoami).toHaveBeenCalledTimes(1)
    expect(mocks.healthCheck).toHaveBeenCalledTimes(0)

    const output = stdout.join('\n')

    expect(output).toContain('Auth token   configured')
    expect(output).toContain('Stored user  stored@example.com')
    expect(output).toContain('Verified user abdallah@example.com')
  })

  it('clears the stored auth token on logout', async () => {
    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test_token',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    await logoutCommand()

    expect(store.getAuthToken()).toBeUndefined()
    expect(stdout.join('\n')).toContain('Cleared stored CLI auth token state.')
  })
})
