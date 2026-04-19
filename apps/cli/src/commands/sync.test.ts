import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveredSession } from '@howicc/parser-core'

const storeContext = vi.hoisted(() => ({
  cwd: '',
  projectName: 'howicc-cli-sync-command-test',
}))

const createSpinner = (text = '') => {
  const spinner = {
    text,
    start: vi.fn(() => spinner),
    stop: vi.fn(() => spinner),
    info: vi.fn(() => spinner),
    succeed: vi.fn(() => spinner),
    fail: vi.fn(() => spinner),
  }

  return spinner
}

const mocks = vi.hoisted(() => ({
  createCliApiClient: vi.fn(),
  discoverClaudeSessions: vi.fn(),
  buildSessionSourceRevisionHashIndex: vi.fn(),
  getPricingCatalog: vi.fn(),
  prepareSessionSync: vi.fn(),
  checkbox: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  whoami: vi.fn(),
  createSession: vi.fn(),
  uploadAsset: vi.fn(),
  finalize: vi.fn(),
  ora: vi.fn((text?: string) => createSpinner(text ?? '')),
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
  checkbox: mocks.checkbox,
  confirm: mocks.confirm,
  select: mocks.select,
}))

vi.mock('../lib/claude', async () => {
  const actual = await vi.importActual<typeof import('../lib/claude')>('../lib/claude')

  return {
    ...actual,
    discoverClaudeSessions: mocks.discoverClaudeSessions,
    buildSessionSourceRevisionHashIndex: mocks.buildSessionSourceRevisionHashIndex,
    getPricingCatalog: mocks.getPricingCatalog,
  }
})

vi.mock('../lib/sync', async () => {
  const actual = await vi.importActual<typeof import('../lib/sync')>('../lib/sync')

  return {
    ...actual,
    prepareSessionSync: mocks.prepareSessionSync,
  }
})

vi.mock('ora', () => ({
  default: mocks.ora,
}))

const { CliConfigStore } = await import('../config/store')
const { syncCommand } = await import('./sync')

const createSession = (sessionId: string, updatedAt: string): DiscoveredSession => ({
  provider: 'claude_code',
  sessionId,
  projectKey: 'project-key',
  projectPath: '/Users/abdallah/Developer/personal/howicc',
  transcriptPath: `/tmp/${sessionId}.jsonl`,
  updatedAt,
  sizeBytes: 1,
  firstPromptPreview: `${sessionId} preview`,
  gitBranch: 'main',
})

const createPreparedSession = (session: DiscoveredSession, sourceRevisionHash: string) => {
  const createAsset = (
    kind: 'source_bundle' | 'canonical_json' | 'render_json',
  ) => {
    const body = new TextEncoder().encode(`${session.sessionId}-${kind}`)

    return {
      kind,
      body,
      bytes: body.byteLength,
      sha256: `${sourceRevisionHash}-${kind}`,
      contentType: 'application/gzip',
    }
  }

  return {
    session,
    sourceRevisionHash,
    sourceApp: session.provider,
    sourceSessionId: session.sessionId,
    sourceProjectKey: session.projectKey,
    title: `${session.sessionId} title`,
    privacy: createPrivacyPreflight(),
    assets: [
      createAsset('source_bundle'),
      createAsset('canonical_json'),
      createAsset('render_json'),
    ],
  }
}

const createPrivacyPreflight = (input?: {
  blocks?: number
  reviews?: number
  warnings?: number
}) => {
  const summary = {
    blocks: input?.blocks ?? 0,
    reviews: input?.reviews ?? 0,
    warnings: input?.warnings ?? 0,
  }

  const status =
    summary.blocks > 0
      ? 'block'
      : summary.reviews > 0
        ? 'review'
        : summary.warnings > 0
          ? 'warning'
          : 'clear'

  return {
    status,
    inspection: {
      findings:
        status === 'clear'
          ? []
          : [
              {
                ruleId: 'privacy-fixture',
                category: summary.blocks > 0 ? 'secret' : 'filesystem',
                severity: status === 'warning' ? 'warning' : status,
                start: 0,
                end: 12,
                matchedTextLength: 12,
                replacement: '<redacted>',
                maskedPreview: summary.blocks > 0 ? 'Bearer <redacted>' : '/Users/<redacted>/project',
                segmentKind: summary.blocks > 0 ? 'source_transcript' : 'render_message',
              },
            ],
      summary,
    },
    sourceInspection: {
      findings: [],
      summary: {
        blocks: summary.blocks,
        reviews: 0,
        warnings: 0,
      },
    },
    renderInspection: {
      findings: [],
      summary: {
        blocks: 0,
        reviews: summary.reviews,
        warnings: summary.warnings,
      },
    },
  }
}

describe('syncCommand', () => {
  const tempDirectories: string[] = []
  let stdout: string[]
  let stderr: string[]

  beforeEach(async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-sync-command-'))
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
      cliAuth: {
        whoami: mocks.whoami,
      },
      uploads: {
        createSession: mocks.createSession,
        uploadAsset: mocks.uploadAsset,
        finalize: mocks.finalize,
      },
    })
    mocks.whoami.mockResolvedValue({
      success: true,
      user: {
        email: 'abdallah@example.com',
      },
    })
    mocks.checkbox.mockResolvedValue([])
    mocks.confirm.mockResolvedValue(true)
    mocks.select.mockResolvedValue('default')
    mocks.getPricingCatalog.mockResolvedValue(undefined)
    mocks.uploadAsset.mockResolvedValue({ success: true })
    mocks.createSession.mockImplementation(async input => ({
      success: true,
      uploadId: `upload_${input.sourceRevisionHash}`,
      assetTargets: input.assets.map((asset: { kind: string }) => ({
        kind: asset.kind,
        key: `${input.sourceRevisionHash}/${asset.kind}.gz`,
      })),
    }))
    mocks.finalize.mockImplementation(async input => ({
      success: true,
      conversationId:
        input.conversationId ?? `conv_${input.sourceRevisionHash}`,
      revisionId: `rev_${input.sourceRevisionHash}`,
    }))
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

  it('skips unchanged revisions, preserves conversation continuity, and stores new revisions', async () => {
    const exactSession = createSession('exact', '2026-04-13T09:00:00.000Z')
    const changedSession = createSession('changed', '2026-04-14T09:00:00.000Z')
    const freshSession = createSession('fresh', '2026-04-15T09:00:00.000Z')
    const sessions = [exactSession, changedSession, freshSession]

    const store = new CliConfigStore()
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
      sessionId: exactSession.sessionId,
      conversationId: 'conv_exact',
      revisionId: 'rev_exact',
      sourceRevisionHash: 'hash-exact',
      syncedAt: '2026-04-13T10:00:00.000Z',
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: changedSession.sessionId,
      conversationId: 'conv_changed',
      revisionId: 'rev_changed_old',
      sourceRevisionHash: 'hash-changed-old',
      syncedAt: '2026-04-14T08:00:00.000Z',
    })

    mocks.discoverClaudeSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:exact', 'hash-exact'],
        ['claude_code:changed', 'hash-changed-new'],
        ['claude_code:fresh', 'hash-fresh'],
      ]),
    )
    mocks.prepareSessionSync.mockImplementation(async session => {
      if (session.sessionId === exactSession.sessionId) {
        return createPreparedSession(session, 'hash-exact')
      }

      if (session.sessionId === changedSession.sessionId) {
        return createPreparedSession(session, 'hash-changed-new')
      }

      return createPreparedSession(session, 'hash-fresh')
    })

    await syncCommand(undefined, { all: true, yes: true })

    expect(mocks.whoami).toHaveBeenCalledTimes(1)
    expect(mocks.prepareSessionSync).toHaveBeenCalledTimes(3)
    expect(mocks.createSession).toHaveBeenCalledTimes(2)
    expect(
      mocks.createSession.mock.calls
        .map(([input]) => input.sourceRevisionHash)
        .sort(),
    ).toEqual(['hash-changed-new', 'hash-fresh'])
    expect(mocks.uploadAsset).toHaveBeenCalledTimes(6)
    expect(mocks.finalize).toHaveBeenCalledTimes(2)
    expect(mocks.finalize.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            sourceRevisionHash: 'hash-changed-new',
            conversationId: 'conv_changed',
          }),
        ],
        [
          expect.objectContaining({
            sourceRevisionHash: 'hash-fresh',
            conversationId: undefined,
          }),
        ],
      ]),
    )

    const updatedStore = new CliConfigStore()

    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: exactSession.sessionId,
        sourceRevisionHash: 'hash-exact',
      }),
    ).toMatchObject({
      conversationId: 'conv_exact',
      revisionId: 'rev_exact',
    })
    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: changedSession.sessionId,
        sourceRevisionHash: 'hash-changed-new',
      }),
    ).toMatchObject({
      conversationId: 'conv_changed',
      revisionId: 'rev_hash-changed-new',
    })
    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: freshSession.sessionId,
        sourceRevisionHash: 'hash-fresh',
      }),
    ).toMatchObject({
      conversationId: 'conv_hash-fresh',
      revisionId: 'rev_hash-fresh',
    })

    const output = stdout.join('\n')

    expect(output).toContain('Selected 3 sessions.')
    expect(output).toContain('Finished sync run. 2 synced, 1 skipped, 0 failed.')
    expect(output).toContain(
      'Use `howicc sync --force` when you want to re-upload unchanged revisions.',
    )
    expect(stderr).toEqual([])
  })

  it('syncs only the interactively selected sessions when --select is used', async () => {
    const olderSession = createSession('older', '2026-04-13T09:00:00.000Z')
    const newerSession = createSession('newer', '2026-04-14T09:00:00.000Z')
    const sessions = [olderSession, newerSession]

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:older', 'hash-older'],
        ['claude_code:newer', 'hash-newer'],
      ]),
    )
    mocks.prepareSessionSync.mockImplementation(async session => {
      if (session.sessionId === olderSession.sessionId) {
        return createPreparedSession(session, 'hash-older')
      }

      return createPreparedSession(session, 'hash-newer')
    })
    mocks.checkbox.mockResolvedValue([olderSession.sessionId])

    await syncCommand(undefined, { select: true })

    expect(mocks.checkbox).toHaveBeenCalledTimes(1)
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(
      mocks.checkbox.mock.calls[0]?.[0]?.choices?.map((choice: { value: string }) => choice.value),
    ).toEqual(['newer', 'older'])
    expect(mocks.createSession).toHaveBeenCalledTimes(1)
    expect(mocks.createSession.mock.calls[0]?.[0]).toMatchObject({
      sourceRevisionHash: 'hash-older',
    })
    expect(mocks.uploadAsset).toHaveBeenCalledTimes(3)
    expect(mocks.finalize).toHaveBeenCalledTimes(1)
    expect(mocks.finalize.mock.calls[0]?.[0]).toMatchObject({
      sourceSessionId: olderSession.sessionId,
    })

    const output = stdout.join('\n')

    expect(output).toContain('Selected 1 session.')
    expect(output).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')
    expect(stderr).toEqual([])
  })

  it('shows the interactive picker slice as a subset of the total session count', async () => {
    const sessions = Array.from({ length: 25 }, (_, index) =>
      createSession(`session-${index + 1}`, `2026-04-${String(15 - Math.min(index, 9)).padStart(2, '0')}T09:00:00.000Z`),
    )

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map(
        sessions.map(session => [
          `claude_code:${session.sessionId}`,
          `hash-${session.sessionId}`,
        ]),
      ),
    )
    mocks.checkbox.mockResolvedValue([])

    await syncCommand(undefined, { select: true })

    expect(stdout.join('\n')).toContain(
      'Showing the 20 most recent sessions in the picker out of 25 total.',
    )
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('retries transient asset upload failures and still finalizes the session', async () => {
    const session = createSession('retryable', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue([session])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:retryable', 'hash-retryable'],
      ]),
    )
    mocks.prepareSessionSync.mockResolvedValue(
      createPreparedSession(session, 'hash-retryable'),
    )

    let failingAttemptCount = 0
    mocks.uploadAsset.mockImplementation(async input => {
      if (input.uploadId === 'upload_hash-retryable' && input.kind === 'render_json') {
        failingAttemptCount += 1

        if (failingAttemptCount === 1) {
          return {
            success: false,
            code: 'internal_error',
            error: 'Temporary storage failure.',
          }
        }
      }

      return { success: true }
    })

    const syncPromise = syncCommand(undefined, { all: true, yes: true })
    await vi.runAllTimersAsync()
    await syncPromise

    expect(mocks.createSession).toHaveBeenCalledTimes(1)
    expect(mocks.uploadAsset).toHaveBeenCalledTimes(4)
    expect(mocks.finalize).toHaveBeenCalledTimes(1)
    expect(mocks.finalize.mock.calls[0]?.[0]).toMatchObject({
      sourceSessionId: session.sessionId,
      sourceRevisionHash: 'hash-retryable',
    })

    const updatedStore = new CliConfigStore()

    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: session.sessionId,
        sourceRevisionHash: 'hash-retryable',
      }),
    ).toMatchObject({
      conversationId: 'conv_hash-retryable',
      revisionId: 'rev_hash-retryable',
    })

    const output = stdout.join('\n')

    expect(output).toContain('Selected 1 session.')
    expect(output).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')
    expect(stderr).toEqual([])
  })

  it('stops after the retry budget is exhausted for retryable upload failures', async () => {
    const session = createSession('retry-exhausted', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue([session])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:retry-exhausted', 'hash-retry-exhausted'],
      ]),
    )
    mocks.prepareSessionSync.mockResolvedValue(
      createPreparedSession(session, 'hash-retry-exhausted'),
    )
    mocks.uploadAsset.mockImplementation(async input => {
      if (input.uploadId === 'upload_hash-retry-exhausted' && input.kind === 'source_bundle') {
        return {
          success: false,
          code: 'internal_error',
          error: 'Temporary storage failure.',
        }
      }

      return { success: true }
    })

    const syncPromise = syncCommand(undefined, { all: true, yes: true })
    await vi.runAllTimersAsync()
    await syncPromise

    expect(mocks.createSession).toHaveBeenCalledTimes(1)
    expect(mocks.uploadAsset).toHaveBeenCalledTimes(3)
    expect(mocks.finalize).toHaveBeenCalledTimes(0)

    const updatedStore = new CliConfigStore()

    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: session.sessionId,
        sourceRevisionHash: 'hash-retry-exhausted',
      }),
    ).toBeUndefined()

    const sessionSpinner = mocks.ora.mock.results
      .map(result => result.value)
      .find((spinner: { text: string }) => spinner.text.includes('[1/1]'))
    const output = stdout.join('\n')

    expect(output).toContain('Finished sync run. 0 synced, 0 skipped, 1 failed.')
    expect(sessionSpinner?.fail).toHaveBeenCalledWith(
      expect.stringContaining('Temporary storage failure. (after 3 attempts)'),
    )
    expect(stderr).toEqual([])
  })

  it('fails fast for resync-required asset upload errors and continues with sibling sessions', async () => {
    const failingSession = createSession('failing', '2026-04-15T09:00:00.000Z')
    const healthySession = createSession('healthy', '2026-04-14T09:00:00.000Z')
    const sessions = [failingSession, healthySession]

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:failing', 'hash-failing'],
        ['claude_code:healthy', 'hash-healthy'],
      ]),
    )
    mocks.prepareSessionSync.mockImplementation(async session => {
      if (session.sessionId === failingSession.sessionId) {
        return createPreparedSession(session, 'hash-failing')
      }

      return createPreparedSession(session, 'hash-healthy')
    })
    mocks.uploadAsset.mockImplementation(async input => {
      if (input.uploadId === 'upload_hash-failing' && input.kind === 'render_json') {
        return {
          success: false,
          code: 'upload_expired',
          error: 'The upload session expired before asset upload completed.',
        }
      }

      return { success: true }
    })

    await syncCommand(undefined, { all: true, yes: true })

    expect(mocks.createSession).toHaveBeenCalledTimes(2)
    expect(mocks.uploadAsset).toHaveBeenCalledTimes(6)
    expect(mocks.finalize).toHaveBeenCalledTimes(1)
    expect(mocks.finalize.mock.calls[0]?.[0]).toMatchObject({
      sourceSessionId: healthySession.sessionId,
      sourceRevisionHash: 'hash-healthy',
    })

    const updatedStore = new CliConfigStore()

    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: failingSession.sessionId,
        sourceRevisionHash: 'hash-failing',
      }),
    ).toBeUndefined()
    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: healthySession.sessionId,
        sourceRevisionHash: 'hash-healthy',
      }),
    ).toMatchObject({
      conversationId: 'conv_hash-healthy',
      revisionId: 'rev_hash-healthy',
    })

    const output = stdout.join('\n')

    expect(output).toContain('Selected 2 sessions.')
    expect(output).toContain('Finished sync run. 1 synced, 0 skipped, 1 failed.')
    expect(stderr).toEqual([])
  })

  it('blocks a session locally when privacy pre-flight finds blocking content', async () => {
    const session = createSession('privacy-blocked', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue([session])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([['claude_code:privacy-blocked', 'hash-privacy-blocked']]),
    )
    mocks.prepareSessionSync.mockResolvedValue({
      ...createPreparedSession(session, 'hash-privacy-blocked'),
      privacy: createPrivacyPreflight({ blocks: 1 }),
    })

    await syncCommand(undefined, { all: true, yes: true })

    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.uploadAsset).not.toHaveBeenCalled()
    expect(mocks.finalize).not.toHaveBeenCalled()

    const updatedStore = new CliConfigStore()

    expect(
      updatedStore.getSyncedRevision({
        provider: 'claude_code',
        sessionId: session.sessionId,
        sourceRevisionHash: 'hash-privacy-blocked',
      }),
    ).toBeUndefined()

    expect(stdout.join('\n')).toContain('Privacy Pre-flight')
    expect(stderr.join('\n')).toContain(
      'Blocked this upload because privacy pre-flight found sensitive content.',
    )
  })

  it('skips a session when review findings are declined interactively', async () => {
    const session = createSession('privacy-review', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue([session])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([['claude_code:privacy-review', 'hash-privacy-review']]),
    )
    mocks.prepareSessionSync.mockResolvedValue({
      ...createPreparedSession(session, 'hash-privacy-review'),
      privacy: createPrivacyPreflight({ reviews: 1 }),
    })
    mocks.confirm.mockReset()
    mocks.confirm.mockResolvedValueOnce(true)
    mocks.select.mockResolvedValueOnce('skip_once')

    await syncCommand(undefined, { all: true })

    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.uploadAsset).not.toHaveBeenCalled()
    expect(mocks.finalize).not.toHaveBeenCalled()

    const sessionSpinner = mocks.ora.mock.results
      .map(result => result.value)
      .find((spinner: { text: string }) => spinner.text.includes('[1/1]'))

    expect(sessionSpinner?.info).toHaveBeenCalledWith(
      expect.stringContaining('skipped after privacy review'),
    )
    expect(stdout.join('\n')).toContain('Privacy Pre-flight')
    expect(stderr).toEqual([])
  })

  it('can approve all remaining review-only sessions after the first prompt', async () => {
    const firstSession = createSession('review-a', '2026-04-15T09:00:00.000Z')
    const secondSession = createSession('review-b', '2026-04-14T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setAuthToken({
      token: 'hwi_test',
      user: {
        id: 'user_123',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })

    mocks.discoverClaudeSessions.mockResolvedValue([firstSession, secondSession])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:review-a', 'hash-review-a'],
        ['claude_code:review-b', 'hash-review-b'],
      ]),
    )
    mocks.prepareSessionSync.mockImplementation(async session => ({
      ...createPreparedSession(session, `hash-${session.sessionId}`),
      privacy: createPrivacyPreflight({ reviews: 1 }),
    }))
    mocks.confirm.mockReset()
    mocks.confirm.mockResolvedValueOnce(true)
    mocks.select.mockResolvedValueOnce('approve_all')

    await syncCommand(undefined, { all: true })

    expect(mocks.select).toHaveBeenCalledTimes(1)
    expect(mocks.createSession).toHaveBeenCalledTimes(2)
    expect(stdout.join('\n')).toContain('Finished sync run. 2 synced, 0 skipped, 0 failed.')
  })

  it('prints a grouped run summary for skipped and failed sessions', async () => {
    const unchangedSession = createSession('exact', '2026-04-13T09:00:00.000Z')
    const blockedSession = createSession('blocked', '2026-04-14T09:00:00.000Z')
    const failingSession = createSession('failing', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
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
      sessionId: unchangedSession.sessionId,
      conversationId: 'conv_exact',
      revisionId: 'rev_exact',
      sourceRevisionHash: 'hash-exact',
      syncedAt: '2026-04-13T10:00:00.000Z',
    })

    mocks.discoverClaudeSessions.mockResolvedValue([
      unchangedSession,
      blockedSession,
      failingSession,
    ])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:exact', 'hash-exact'],
        ['claude_code:blocked', 'hash-blocked'],
        ['claude_code:failing', 'hash-failing'],
      ]),
    )
    mocks.prepareSessionSync.mockImplementation(async session => {
      if (session.sessionId === blockedSession.sessionId) {
        return {
          ...createPreparedSession(session, 'hash-blocked'),
          privacy: createPrivacyPreflight({ blocks: 1 }),
        }
      }

      if (session.sessionId === failingSession.sessionId) {
        return createPreparedSession(session, 'hash-failing')
      }

      return createPreparedSession(session, 'hash-exact')
    })
    mocks.finalize.mockImplementation(async input => {
      if (input.sourceRevisionHash === 'hash-failing') {
        return {
          success: false,
          error: 'Could not reserve a unique conversation slug. Please retry the sync.',
        }
      }

      return {
        success: true,
        conversationId: input.conversationId ?? `conv_${input.sourceRevisionHash}`,
        revisionId: `rev_${input.sourceRevisionHash}`,
      }
    })

    await syncCommand(undefined, { all: true, yes: true })

    const output = stdout.join('\n')
    expect(output).toContain('Run Summary')
    expect(output).toContain('unchanged revision — exact')
    expect(output).toContain('blocked by privacy pre-flight — blocked')
    expect(output).toContain(
      'upload failed: Could not reserve a unique conversation slug. Please retry the sync. — failing',
    )
  })
})
