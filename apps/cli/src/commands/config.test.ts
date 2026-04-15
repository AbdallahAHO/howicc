import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeContext = vi.hoisted(() => ({
  cwd: '',
  projectName: 'howicc-cli-config-command-test',
}))

const mocks = vi.hoisted(() => ({
  createCliApiClient: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  healthCheck: vi.fn(),
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

vi.mock('@inquirer/prompts', () => ({
  input: mocks.input,
  confirm: mocks.confirm,
}))

const { CliConfigStore } = await import('../config/store')
const { configCommand, resetConfig, showConfig } = await import('./config')

describe('config commands', () => {
  const tempDirectories: string[] = []
  let stdout: string[]
  let stderr: string[]
  let originalApiUrl: string | undefined
  let originalWebUrl: string | undefined

  beforeEach(async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-config-command-'))
    tempDirectories.push(cwd)
    storeContext.cwd = cwd

    stdout = []
    stderr = []

    originalApiUrl = process.env.HOWICC_API_URL
    originalWebUrl = process.env.HOWICC_WEB_URL

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
    })
    mocks.input.mockResolvedValueOnce('http://127.0.0.1:8787')
    mocks.input.mockResolvedValueOnce('http://127.0.0.1:4321')
    mocks.confirm.mockResolvedValue(true)
    mocks.healthCheck.mockResolvedValue({ success: true, status: 'ok' })
  })

  afterEach(async () => {
    if (originalApiUrl === undefined) {
      delete process.env.HOWICC_API_URL
    } else {
      process.env.HOWICC_API_URL = originalApiUrl
    }

    if (originalWebUrl === undefined) {
      delete process.env.HOWICC_WEB_URL
    } else {
      process.env.HOWICC_WEB_URL = originalWebUrl
    }

    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()

    await Promise.all(
      tempDirectories.splice(0).map(directory =>
        rm(directory, { recursive: true, force: true }),
      ),
    )
  })

  it('prompts for config values, persists them, and reports API health', async () => {
    await configCommand()

    expect(mocks.input).toHaveBeenCalledTimes(2)
    expect(mocks.healthCheck).toHaveBeenCalledTimes(1)

    const store = new CliConfigStore()

    expect(store.getApiBaseUrl()).toBe('http://127.0.0.1:8787')
    expect(store.getWebBaseUrl()).toBe('http://127.0.0.1:4321')

    const output = stdout.join('\n')

    expect(output).toContain('Configuration')
    expect(output).toContain('Set the API and web origins')
    expect(output).toContain('Configuration saved. API health is ok.')
    expect(output).toContain(store.getPath())
    expect(stderr).toEqual([])
  })

  it('warns when runtime overrides are active and health check fails', async () => {
    process.env.HOWICC_API_URL = 'https://api.runtime.example'
    process.env.HOWICC_WEB_URL = 'https://web.runtime.example'
    mocks.input.mockReset()
    mocks.input.mockResolvedValueOnce('https://api.persisted.example')
    mocks.input.mockResolvedValueOnce('https://web.persisted.example')
    mocks.healthCheck.mockRejectedValue(new Error('down'))

    await configCommand()

    const output = stdout.join('\n')

    expect(output).toContain('Runtime environment variables will override stored values')
    expect(output).toContain('Configuration saved, but the API health check failed.')
  })

  it('shows stored config, auth, and tracked revisions including runtime override labels', async () => {
    process.env.HOWICC_API_URL = 'https://api.runtime.example'
    process.env.HOWICC_WEB_URL = 'https://web.runtime.example'

    const store = new CliConfigStore()
    store.setApiBaseUrl('https://api.persisted.example')
    store.setWebBaseUrl('https://web.persisted.example')
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session_a',
      conversationId: 'conv_a',
      revisionId: 'rev_a',
      sourceRevisionHash: 'hash_a',
      syncedAt: '2026-04-15T09:00:00.000Z',
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session_a',
      conversationId: 'conv_a',
      revisionId: 'rev_b',
      sourceRevisionHash: 'hash_b',
      syncedAt: '2026-04-15T09:30:00.000Z',
    })

    await showConfig()

    const output = stdout.join('\n')

    expect(output).toContain('API URL')
    expect(output).toContain('runtime override')
    expect(output).toContain('configured as abdallah@example.com')
    expect(output).toContain('Tracked syncs')
    expect(output).toContain('2 revisions')
    expect(output).toContain(store.getPath())
  })

  it('cancels config reset when the confirmation prompt is declined', async () => {
    const store = new CliConfigStore()
    store.setApiBaseUrl('https://api.persisted.example')
    mocks.confirm.mockResolvedValue(false)

    await resetConfig()

    expect(store.getApiBaseUrl()).toBe('https://api.persisted.example')
    expect(stdout.join('\n')).toContain('Cancelled.')
  })

  it('resets stored config, auth, and sync state when confirmed', async () => {
    const store = new CliConfigStore()
    store.setApiBaseUrl('https://api.persisted.example')
    store.setWebBaseUrl('https://web.persisted.example')
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session_a',
      conversationId: 'conv_a',
      revisionId: 'rev_a',
      sourceRevisionHash: 'hash_a',
      syncedAt: '2026-04-15T09:00:00.000Z',
    })

    await resetConfig({ yes: true })

    expect(store.getAuthToken()).toBeUndefined()
    expect(Object.keys(store.getSyncedRevisions())).toHaveLength(0)
    expect(stdout.join('\n')).toContain('Configuration reset to defaults.')
    expect(stdout.join('\n')).toContain('Runtime HOWICC_API_URL and HOWICC_WEB_URL overrides still apply')
  })
})
