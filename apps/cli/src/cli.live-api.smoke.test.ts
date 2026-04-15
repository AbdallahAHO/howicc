import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createClaudeFixtureEnvironment,
  writeClaudeSessionTranscript,
  type ClaudeFixtureEnvironment,
} from './test-support/claude-fixtures'
import {
  buildCliEnvironment,
  findFreePort,
  runCliProcess,
  runProcess,
  runTsxScript,
  terminateChildProcess,
  waitForHttpReady,
} from './test-support/cli-process'
import { buildCliStoreHelperScript } from './test-support/cli-store-helper'
import { buildOpenRouterCatalogPreload } from './test-support/openrouter-preload'

const apiAppDirectory = fileURLToPath(new URL('../../api', import.meta.url))

type LiveApiHarness = {
  rootDir: string
  homeDir: string
  claude: ClaudeFixtureEnvironment
  persistDir: string
  envFilePath: string
  storeHelperPath: string
  preloadPath: string
  apiPort: number
  apiBaseUrl: string
  serverProcess?: ChildProcess
}

type SyncedRevisionRecord = Record<string, {
  conversationId: string
  revisionId: string
  sourceRevisionHash: string
  syncedAt: string
  sessionId: string
  provider: string
}>

const localD1DatabaseName = 'howicc-prod-db'
const tempDirectories: string[] = []
const activeProcesses = new Set<ChildProcess>()

afterEach(async () => {
  await Promise.all(
    [...activeProcesses].map(async process => {
      activeProcesses.delete(process)
      await terminateChildProcess(process)
    }),
  )

  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe.sequential('CLI live local API smoke', () => {
  it('verifies whoami against the real local Wrangler API backed by isolated D1 state', async () => {
    const harness = await createLiveApiHarness()
    const token = 'hwi_live_token'

    await prepareLocalD1(harness)
    await seedLocalCliToken(harness, {
      token,
      user: {
        id: 'user_live',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    await seedLocalApiUserAndToken(harness, token)
    await startLocalApiServer(harness)

    const result = await runCli(harness, ['whoami'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('HowiCC CLI Auth State')
    expect(result.stdout).toContain('Auth token   configured')
    expect(result.stdout).toContain('Stored user  abdallah@example.com')
    expect(result.stdout).toContain('Verified user abdallah@example.com')
    expect(result.stderr).toBe('')
  }, 90_000)

  it('syncs a real local session through Wrangler, records the revision, and skips the unchanged rerun', async () => {
    const harness = await createLiveApiHarness()
    const token = 'hwi_live_sync_token'
    const sessionId = '123e4567-e89b-42d3-a456-426614174101'

    await prepareLocalD1(harness)
    await seedLocalCliToken(harness, {
      token,
      user: {
        id: 'user_live',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
    })
    await seedLocalApiUserAndToken(harness, token)
    await writeClaudeSessionTranscript(harness.claude, {
      sessionId,
      turns: [
        {
          user: 'Map the live sync journey against the local API',
          assistant: 'I inspected the sync pipeline and prepared the upload.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: path.join(harness.claude.projectDir, 'apps/cli/src/sync.ts'),
              },
            },
          ],
        },
      ],
    })
    await startLocalApiServer(harness)

    const firstSync = await runCli(harness, ['sync', '--all', '--yes'], { timeoutMs: 60_000 })

    expect(firstSync.code).toBe(0)
    expectNoCliFailure(firstSync)
    expect(firstSync.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')

    const syncedRevisionsAfterFirstRun = Object.values(await readSyncedRevisions(harness))
    expect(syncedRevisionsAfterFirstRun).toHaveLength(1)

    const storedRevision = syncedRevisionsAfterFirstRun[0]!
    const conversationRows = await queryLocalD1Rows<{
      conversationId: string
      sourceSessionId: string
      revisionId: string
      sourceRevisionHash: string
    }>(
      harness,
      `select c.id as conversationId, c.source_session_id as sourceSessionId, r.id as revisionId, r.source_revision_hash as sourceRevisionHash
       from conversations c
       join conversation_revisions r on r.conversation_id = c.id
       order by r.created_at asc;`,
    )

    expect(conversationRows).toHaveLength(1)
    expect(conversationRows[0]).toMatchObject({
      conversationId: storedRevision.conversationId,
      sourceSessionId: sessionId,
      revisionId: storedRevision.revisionId,
      sourceRevisionHash: storedRevision.sourceRevisionHash,
    })
    expect(await queryLocalD1Count(harness, 'select count(*) as count from conversation_assets;')).toBe(3)
    expect(
      await queryLocalD1Count(
        harness,
        "select count(*) as count from upload_sessions where status = 'finalized';",
      ),
    ).toBe(1)

    const unchangedSync = await runCli(harness, ['sync', '--all', '--yes'], {
      timeoutMs: 60_000,
    })

    expect(unchangedSync.code).toBe(0)
    expectNoCliFailure(unchangedSync)
    expect(unchangedSync.stdout).toContain('Finished sync run. 0 synced, 1 skipped, 0 failed.')
    expect(unchangedSync.stdout).toContain(
      'Use `howicc sync --force` when you want to re-upload unchanged revisions.',
    )

    const syncedRevisionsAfterSecondRun = Object.values(await readSyncedRevisions(harness))
    expect(syncedRevisionsAfterSecondRun).toHaveLength(1)
    expect(await queryLocalD1Count(harness, 'select count(*) as count from conversations;')).toBe(1)
    expect(await queryLocalD1Count(harness, 'select count(*) as count from conversation_revisions;')).toBe(1)
    expect(await queryLocalD1Count(harness, 'select count(*) as count from conversation_assets;')).toBe(3)
    expect(
      await queryLocalD1Count(
        harness,
        "select count(*) as count from upload_sessions where status = 'finalized';",
      ),
    ).toBe(1)
  }, 120_000)
})

const createLiveApiHarness = async (): Promise<LiveApiHarness> => {
  const claude = await createClaudeFixtureEnvironment('howicc-cli-live-api')
  tempDirectories.push(claude.rootDir)

  const homeDir = path.join(claude.rootDir, 'home')
  const persistDir = path.join(claude.rootDir, 'wrangler-state')
  const envFilePath = path.join(claude.rootDir, '.dev.vars')
  const storeHelperPath = path.join(claude.rootDir, 'store-helper.ts')
  const preloadPath = path.join(claude.rootDir, 'openrouter-preload.mjs')
  const apiPort = await findFreePort()

  await Promise.all([
    mkdir(path.join(homeDir, '.config'), { recursive: true }),
    writeFile(envFilePath, buildApiEnvFile(apiPort)),
    writeFile(storeHelperPath, buildCliStoreHelperScript()),
    writeFile(preloadPath, buildOpenRouterCatalogPreload()),
  ])

  return {
    rootDir: claude.rootDir,
    homeDir,
    claude,
    persistDir,
    envFilePath,
    storeHelperPath,
    preloadPath,
    apiPort,
    apiBaseUrl: `http://127.0.0.1:${apiPort}`,
  }
}

const buildApiEnvFile = (apiPort: number) => [
  'APP_ENV="development"',
  'PRODUCT_NAME="HowiCC"',
  `API_BASE_URL="http://127.0.0.1:${apiPort}"`,
  'WEB_APP_URL="http://localhost:4321"',
  'SHARE_TOKEN_SECRET="dev-share-token-secret-change-me-please"',
  'BETTER_AUTH_SECRET="dev-better-auth-secret-change-me-please"',
  'GITHUB_CLIENT_ID=""',
  'GITHUB_CLIENT_SECRET=""',
  'DB_PROVIDER="d1"',
  'DATABASE_URL=""',
  'STORAGE_PROVIDER="r2"',
  'STORAGE_BUCKET_NAME=""',
  'STORAGE_REGION="auto"',
  'STORAGE_ENDPOINT=""',
  'STORAGE_ACCESS_KEY_ID=""',
  'STORAGE_SECRET_ACCESS_KEY=""',
  '',
].join('\n')

const prepareLocalD1 = async (harness: LiveApiHarness) => {
  const result = await runProcess(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      localD1DatabaseName,
      '--local',
      '--persist-to',
      harness.persistDir,
      '--env-file',
      harness.envFilePath,
      '--config',
      'wrangler.jsonc',
    ],
    {
      cwd: apiAppDirectory,
      env: process.env,
      timeoutMs: 60_000,
    },
  )

  expect(result.code).toBe(0)
}

const seedLocalApiUserAndToken = async (
  harness: LiveApiHarness,
  token: string,
) => {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = Date.parse('2026-04-15T10:00:00.000Z')
  const sql = [
    `INSERT INTO users (id, github_user_id, email, email_verified, name, image, created_at, updated_at) VALUES ('user_live', NULL, 'abdallah@example.com', 1, 'Abdallah', NULL, ${now}, ${now});`,
    `INSERT INTO api_tokens (id, user_id, token_prefix, token_hash, created_at, revoked_at) VALUES ('token_live_${token.slice(-6)}', 'user_live', '${token.slice(0, 8)}', '${tokenHash}', ${now}, NULL);`,
  ].join(' ')

  const result = await executeLocalD1(harness, sql)

  expect(result[0]?.success).toBe(true)
}

const startLocalApiServer = async (harness: LiveApiHarness) => {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const child = spawn(
    command,
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(harness.apiPort),
      '--persist-to',
      harness.persistDir,
      '--env-file',
      harness.envFilePath,
      '--config',
      'wrangler.jsonc',
      '--show-interactive-dev-session=false',
      '--log-level',
      'error',
    ],
    {
      cwd: apiAppDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  activeProcesses.add(child)
  harness.serverProcess = child

  const startupLogs: string[] = []
  child.stdout?.on('data', chunk => {
    startupLogs.push(chunk.toString('utf8'))
  })
  child.stderr?.on('data', chunk => {
    startupLogs.push(chunk.toString('utf8'))
  })

  await waitForHttpReady(new URL('/health', harness.apiBaseUrl).toString(), 30_000).catch(error => {
    throw new Error(`Local API failed to start:\n${startupLogs.join('')}\n${String(error)}`)
  })
}

const seedLocalCliToken = async (
  harness: LiveApiHarness,
  payload: {
    token: string
    user: {
      id: string
      email: string
      name: string
    }
  },
) => {
  const result = await runStoreHelper<{ authToken?: string }>(
    harness,
    'seed-auth',
    payload,
  )

  expect(result.authToken).toBe(payload.token)
}

const readSyncedRevisions = async (harness: LiveApiHarness) =>
  runStoreHelper<SyncedRevisionRecord>(harness, 'get-synced-revisions')

const runCli = async (
  harness: LiveApiHarness,
  args: string[],
  options: { timeoutMs?: number } = {},
) =>
  runCliProcess({
    args,
    env: buildCliEnvironment({
      homeDir: harness.homeDir,
      claudeHomeDir: harness.claude.claudeHomeDir,
      apiBaseUrl: harness.apiBaseUrl,
    }),
    preloadPath: harness.preloadPath,
    timeoutMs: options.timeoutMs,
  })

const runStoreHelper = async <T>(
  harness: LiveApiHarness,
  action: string,
  payload?: unknown,
): Promise<T> => {
  const result = await runTsxScript({
    scriptPath: harness.storeHelperPath,
    args: [action, payload === undefined ? 'null' : JSON.stringify(payload)],
    env: buildCliEnvironment({
      homeDir: harness.homeDir,
      claudeHomeDir: harness.claude.claudeHomeDir,
      apiBaseUrl: harness.apiBaseUrl,
    }),
    timeoutMs: 30_000,
  })

  expect(result.code).toBe(0)
  expect(result.stderr).toBe('')

  return JSON.parse(result.stdout) as T
}

const executeLocalD1 = async <T extends Record<string, unknown>>(
  harness: LiveApiHarness,
  sql: string,
) => {
  const result = await runProcess(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      localD1DatabaseName,
      '--local',
      '--persist-to',
      harness.persistDir,
      '--env-file',
      harness.envFilePath,
      '--config',
      'wrangler.jsonc',
      '--command',
      sql,
      '--json',
    ],
    {
      cwd: apiAppDirectory,
      env: process.env,
      timeoutMs: 60_000,
    },
  )

  expect(result.code).toBe(0)

  return JSON.parse(result.stdout) as Array<{
    results: T[]
    success: boolean
    meta?: Record<string, unknown>
  }>
}

const queryLocalD1Rows = async <T extends Record<string, unknown>>(
  harness: LiveApiHarness,
  sql: string,
) => {
  const result = await executeLocalD1<T>(harness, sql)
  return result[0]?.results ?? []
}

const queryLocalD1Count = async (
  harness: LiveApiHarness,
  sql: string,
) => {
  const rows = await queryLocalD1Rows<{ count: number | string }>(harness, sql)
  return Number(rows[0]?.count ?? 0)
}

const expectNoCliFailure = (result: { stderr: string }) => {
  expect(result.stderr).not.toContain(' failed:')
  expect(result.stderr).not.toContain(' ✗ ')
}
