import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionDigest } from '@howicc/canonical'
import type { DiscoveredSession } from '@howicc/parser-core'

const storeContext = vi.hoisted(() => ({
  cwd: '',
  projectName: 'howicc-cli-list-command-test',
}))

const createSpinner = (text = '') => {
  const spinner = {
    text,
    start: vi.fn(() => spinner),
    stop: vi.fn(() => spinner),
  }

  return spinner
}

const mocks = vi.hoisted(() => ({
  discoverSessions: vi.fn(),
  buildSourceBundle: vi.fn(),
  parseCanonicalSession: vi.fn(),
  extractSessionDigest: vi.fn(),
  buildSessionSourceRevisionHashIndex: vi.fn(),
  getPricingCatalog: vi.fn(),
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

vi.mock('../lib/claude', async () => {
  const actual = await vi.importActual<typeof import('../lib/claude')>('../lib/claude')

  return {
    ...actual,
    buildSessionSourceRevisionHashIndex: mocks.buildSessionSourceRevisionHashIndex,
    getPricingCatalog: mocks.getPricingCatalog,
  }
})

vi.mock('@howicc/provider-claude-code', () => ({
  ClaudeCodeAdapter: {
    discoverSessions: mocks.discoverSessions,
    buildSourceBundle: mocks.buildSourceBundle,
    parseCanonicalSession: mocks.parseCanonicalSession,
  },
}))

vi.mock('@howicc/profile', () => ({
  extractSessionDigest: mocks.extractSessionDigest,
}))

vi.mock('ora', () => ({
  default: mocks.ora,
}))

const { CliConfigStore } = await import('../config/store')
const { listCommand } = await import('./list')

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

const createDigest = (
  session: DiscoveredSession,
  title: string,
): SessionDigest => ({
  sessionId: session.sessionId,
  provider: session.provider,
  projectKey: session.projectKey,
  projectPath: session.projectPath,
  gitBranch: session.gitBranch,
  title,
  createdAt: session.createdAt ?? session.updatedAt,
  updatedAt: session.updatedAt,
  durationMs: 20 * 60_000,
  dayOfWeek: 3,
  turnCount: 4,
  messageCount: 8,
  toolRunCount: 2,
  toolCategories: {
    read: 0,
    write: 0,
    search: 0,
    command: 0,
    agent: 0,
    mcp: 0,
    plan: 0,
    question: 0,
    task: 0,
    web: 0,
    other: 0,
  },
  errorCount: 0,
  apiErrorCount: 0,
  apiErrorTypes: {},
  rejectionCount: 0,
  interruptionCount: 0,
  compactionCount: 0,
  subagentCount: 0,
  hasPlan: false,
  hasThinking: false,
  models: [],
  hourOfDay: 10,
  sessionType: 'building',
  filesChanged: ['apps/cli/src/index.ts'],
  filesRead: ['apps/cli/src/index.ts'],
  languages: { ts: 1 },
  fileIterationDepth: 1,
  gitCommits: 1,
  gitPushes: 0,
  prLinks: [],
  mcpServersConfigured: [],
  mcpServersUsed: [],
  skillsTriggered: [],
})

describe('listCommand', () => {
  const tempDirectories: string[] = []
  let stdout: string[]

  beforeEach(async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-list-command-'))
    tempDirectories.push(cwd)
    storeContext.cwd = cwd

    stdout = []

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'))
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      stdout.push(args.join(' '))
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.getPricingCatalog.mockResolvedValue(undefined)
    mocks.buildSourceBundle.mockImplementation(async session => ({
      sessionId: session.sessionId,
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

  it('shows only sessions that are new or changed when filtering by unsynced state', async () => {
    const exactSession = createSession('exact', '2026-04-13T09:00:00.000Z')
    const updatedSession = createSession('updated', '2026-04-14T09:00:00.000Z')
    const neverSession = createSession('never', '2026-04-15T09:00:00.000Z')
    const sessions = [exactSession, updatedSession, neverSession]

    const store = new CliConfigStore()
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: exactSession.sessionId,
      conversationId: 'conv_exact',
      revisionId: 'rev_exact_current',
      sourceRevisionHash: 'hash-exact',
      syncedAt: '2026-04-13T10:00:00.000Z',
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: exactSession.sessionId,
      conversationId: 'conv_exact',
      revisionId: 'rev_exact_latest',
      sourceRevisionHash: 'hash-exact-newer',
      syncedAt: '2026-04-14T10:00:00.000Z',
    })
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: updatedSession.sessionId,
      conversationId: 'conv_updated',
      revisionId: 'rev_updated_old',
      sourceRevisionHash: 'hash-updated-old',
      syncedAt: '2026-04-13T08:00:00.000Z',
    })

    const revisionHashes = {
      exact: 'hash-exact',
      updated: 'hash-updated-current',
      never: 'hash-never',
    }
    const digests = {
      updated: createDigest(updatedSession, 'Updated session title'),
      never: createDigest(neverSession, 'Never synced session title'),
    }

    mocks.discoverSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:exact', revisionHashes.exact],
        ['claude_code:updated', revisionHashes.updated],
        ['claude_code:never', revisionHashes.never],
      ]),
    )
    mocks.parseCanonicalSession.mockImplementation(async bundle => ({
      provider: 'claude_code',
      source: {
        sourceRevisionHash: revisionHashes[bundle.sessionId as keyof typeof revisionHashes],
      },
      sessionId: bundle.sessionId,
    }))
    mocks.extractSessionDigest.mockImplementation(canonical =>
      digests[canonical.sessionId as keyof typeof digests],
    )

    await listCommand({ unsynced: true, all: true })

    expect(mocks.buildSourceBundle).toHaveBeenCalledTimes(2)
    expect(mocks.parseCanonicalSession).toHaveBeenCalledTimes(2)
    expect(mocks.extractSessionDigest).toHaveBeenCalledTimes(2)

    const output = stdout.join('\n')

    expect(output).toContain('Showing all 2 matching sessions (3 discovered total)')
    expect(output).toContain('Updated session title')
    expect(output).toContain('Never synced session title')
    expect(output).not.toContain('exact preview')
    expect(output).toContain('Updated since last sync')
    expect(output).toContain('Not synced yet')
  })

  it('shows only fully synced sessions when filtering by synced state', async () => {
    const syncedSession = createSession('synced', '2026-04-15T09:00:00.000Z')
    const unsyncedSession = createSession('unsynced', '2026-04-14T09:00:00.000Z')
    const sessions = [syncedSession, unsyncedSession]

    const store = new CliConfigStore()
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: syncedSession.sessionId,
      conversationId: 'conv_synced',
      revisionId: 'rev_synced',
      sourceRevisionHash: 'hash-synced',
      syncedAt: '2026-04-15T09:30:00.000Z',
    })

    mocks.discoverSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:synced', 'hash-synced'],
        ['claude_code:unsynced', 'hash-unsynced'],
      ]),
    )
    mocks.parseCanonicalSession.mockResolvedValue({
      provider: 'claude_code',
      source: {
        sourceRevisionHash: 'hash-synced',
      },
      sessionId: syncedSession.sessionId,
    })
    mocks.extractSessionDigest.mockReturnValue(
      createDigest(syncedSession, 'Synced session title'),
    )

    await listCommand({ synced: true, all: true })

    expect(mocks.buildSourceBundle).toHaveBeenCalledTimes(1)
    expect(mocks.parseCanonicalSession).toHaveBeenCalledTimes(1)
    expect(mocks.extractSessionDigest).toHaveBeenCalledTimes(1)

    const output = stdout.join('\n')

    expect(output).toContain('Showing all 1 matching sessions (2 discovered total)')
    expect(output).toContain('Synced session title')
    expect(output).toContain('1 already synced')
    expect(output).not.toContain('unsynced preview')
  })

  it('respects the explicit limit and suggests how to fetch more rows', async () => {
    const newest = createSession('newest', '2026-04-15T09:00:00.000Z')
    const middle = createSession('middle', '2026-04-14T09:00:00.000Z')
    const older = createSession('older', '2026-04-13T09:00:00.000Z')
    const sessions = [newest, middle, older]

    mocks.discoverSessions.mockResolvedValue(sessions)
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:newest', 'hash-newest'],
        ['claude_code:middle', 'hash-middle'],
        ['claude_code:older', 'hash-older'],
      ]),
    )
    mocks.parseCanonicalSession.mockImplementation(async bundle => ({
      provider: 'claude_code',
      source: {
        sourceRevisionHash: `hash-${bundle.sessionId}`,
      },
      sessionId: bundle.sessionId,
    }))
    mocks.extractSessionDigest.mockImplementation(canonical =>
      createDigest(
        sessions.find(session => session.sessionId === canonical.sessionId)!,
        `${canonical.sessionId} title`,
      ),
    )

    await listCommand({ limit: 2 })

    const output = stdout.join('\n')

    expect(output).toContain('Showing 2 of 3 discovered sessions')
    expect(output).toContain('Use `howicc list --limit 3` or `howicc list --all` for more.')
    expect(output).toContain('newest title')
    expect(output).toContain('middle title')
    expect(output).not.toContain('older title')
  })

  it('shows an empty state when no local Claude sessions exist', async () => {
    mocks.discoverSessions.mockResolvedValue([])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(new Map())

    await listCommand()

    const output = stdout.join('\n')

    expect(output).toContain('No Claude Code sessions were found on this machine.')
    expect(output).toContain('Run `howicc sync --help` once you have local Claude activity to upload.')
  })

  it('shows an empty-state hint when no sessions match the selected sync filter', async () => {
    const syncedSession = createSession('synced', '2026-04-15T09:00:00.000Z')

    const store = new CliConfigStore()
    store.setSyncedRevision({
      provider: 'claude_code',
      sessionId: syncedSession.sessionId,
      conversationId: 'conv_synced',
      revisionId: 'rev_synced',
      sourceRevisionHash: 'hash-synced',
      syncedAt: '2026-04-15T09:30:00.000Z',
    })

    mocks.discoverSessions.mockResolvedValue([syncedSession])
    mocks.buildSessionSourceRevisionHashIndex.mockResolvedValue(
      new Map([
        ['claude_code:synced', 'hash-synced'],
      ]),
    )

    await listCommand({ unsynced: true })

    const output = stdout.join('\n')

    expect(output).toContain('No sessions matched the selected filter.')
    expect(output).toContain('Try `howicc list --all` or remove the sync-state filter.')
  })
})
