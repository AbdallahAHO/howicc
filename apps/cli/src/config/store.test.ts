import Conf from 'conf'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CliConfigStore } from './store'

const originalApiUrl = process.env.HOWICC_API_URL
const originalWebUrl = process.env.HOWICC_WEB_URL
const tempDirectories: string[] = []

afterEach(async () => {
  if (originalApiUrl === undefined) delete process.env.HOWICC_API_URL
  else process.env.HOWICC_API_URL = originalApiUrl

  if (originalWebUrl === undefined) delete process.env.HOWICC_WEB_URL
  else process.env.HOWICC_WEB_URL = originalWebUrl

  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

const createStore = async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-config-'))
  tempDirectories.push(cwd)

  return new CliConfigStore({
    cwd,
    projectName: `howicc-test-${tempDirectories.length}`,
    projectSuffix: '',
  })
}

describe('CliConfigStore', () => {
  it('prefers runtime env URLs over persisted config values', async () => {
    const store = await createStore()

    store.setApiBaseUrl('https://persisted-api.example.com')
    store.setWebBaseUrl('https://persisted-web.example.com')

    process.env.HOWICC_API_URL = 'http://localhost:8787'
    process.env.HOWICC_WEB_URL = 'http://localhost:4321'

    expect(store.getApiBaseUrl()).toBe('http://localhost:8787')
    expect(store.getWebBaseUrl()).toBe('http://localhost:4321')
  })

  it('falls back to persisted config values when runtime overrides are absent', async () => {
    const store = await createStore()

    store.setApiBaseUrl('http://127.0.0.1:8787')
    store.setWebBaseUrl('http://127.0.0.1:4321')

    delete process.env.HOWICC_API_URL
    delete process.env.HOWICC_WEB_URL

    expect(store.getApiBaseUrl()).toBe('http://127.0.0.1:8787')
    expect(store.getWebBaseUrl()).toBe('http://127.0.0.1:4321')
  })

  it('persists synced revisions and updates the last sync timestamp', async () => {
    const store = await createStore()

    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session-123',
      conversationId: 'conv_123',
      revisionId: 'rev_123',
      sourceRevisionHash: 'hash_123',
      syncedAt: '2026-04-09T08:00:00.000Z',
    })

    expect(
      store.getSyncedRevision({
        provider: 'claude_code',
        sessionId: 'session-123',
        sourceRevisionHash: 'hash_123',
      }),
    ).toEqual({
      provider: 'claude_code',
      sessionId: 'session-123',
      conversationId: 'conv_123',
      revisionId: 'rev_123',
      sourceRevisionHash: 'hash_123',
      syncedAt: '2026-04-09T08:00:00.000Z',
    })
    expect(store.getAll().lastSyncAt).toBe('2026-04-09T08:00:00.000Z')
  })

  it('clears tracked sync state independently of auth state', async () => {
    const store = await createStore()

    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session-123',
      conversationId: 'conv_123',
      revisionId: 'rev_123',
      sourceRevisionHash: 'hash_123',
      syncedAt: '2026-04-09T08:00:00.000Z',
    })

    store.clearSyncedRevisions()

    expect(store.getSyncedRevisions()).toEqual({})
    expect(store.getAll().lastSyncAt).toBeUndefined()
  })

  it('migrates legacy per-session sync state into revision records', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-config-migrate-'))
    tempDirectories.push(cwd)

    const legacyConfig = new Conf<{
      schemaVersion: 1
      sessionSyncState?: Record<string, {
        conversationId: string
        revisionId: string
        sourceRevisionHash: string
        syncedAt: string
      }>
    }>({
      cwd,
      projectName: 'howicc-test-migrate',
      projectSuffix: '',
    })

    legacyConfig.set('schemaVersion', 1)
    legacyConfig.set('sessionSyncState', {
      'session-123': {
        conversationId: 'conv_123',
        revisionId: 'rev_123',
        sourceRevisionHash: 'hash_123',
        syncedAt: '2026-04-09T08:00:00.000Z',
      },
    })

    const store = new CliConfigStore({
      cwd,
      projectName: 'howicc-test-migrate',
      projectSuffix: '',
    })

    expect(
      store.getSyncedRevision({
        provider: 'claude_code',
        sessionId: 'session-123',
        sourceRevisionHash: 'hash_123',
      }),
    ).toMatchObject({
      provider: 'claude_code',
      sessionId: 'session-123',
      conversationId: 'conv_123',
      revisionId: 'rev_123',
      sourceRevisionHash: 'hash_123',
      syncedAt: '2026-04-09T08:00:00.000Z',
    })
    expect(legacyConfig.get('sessionSyncState')).toBeUndefined()
    expect(store.getAll().schemaVersion).toBe(2)
  })

  it('resets the stored configuration back to defaults', async () => {
    const store = await createStore()

    store.setApiBaseUrl('https://persisted-api.example.com')
    store.setWebBaseUrl('https://persisted-web.example.com')
    store.setAuthToken({
      token: 'token_123',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: 'session-123',
      conversationId: 'conv_123',
      revisionId: 'rev_123',
      sourceRevisionHash: 'hash_123',
      syncedAt: '2026-04-09T08:00:00.000Z',
    })

    store.reset()

    expect(store.getAuthToken()).toBeUndefined()
    expect(store.getSyncedRevisions()).toEqual({})
    expect(store.getApiBaseUrl()).toBe('https://api.howi.cc')
    expect(store.getWebBaseUrl()).toBe('https://howi.cc')
  })
})
