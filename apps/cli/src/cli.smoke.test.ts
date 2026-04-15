import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createClaudeFixtureEnvironment,
  writeBrokenClaudeSessionTranscript,
  writeClaudeSessionTranscript,
  type ClaudeFixtureEnvironment,
} from './test-support/claude-fixtures'
import {
  buildCliEnvironment,
  runCliProcess,
  runTsxScript,
  type CliRunResult,
} from './test-support/cli-process'
import { buildCliStoreHelperScript } from './test-support/cli-store-helper'
import { buildOpenRouterCatalogPreload } from './test-support/openrouter-preload'

type CliSmokeHarness = {
  rootDir: string
  homeDir: string
  claude: ClaudeFixtureEnvironment
  preloadPath: string
  storeHelperPath: string
  apiBaseUrl: string
  apiState: FakeApiState
  server: Server
}

type FakeApiFailure = {
  status: number
  code: string
  error: string
}

type FakeUploadAssetFailure = FakeApiFailure & {
  sourceRevisionHash?: string
  uploadId?: string
  kind?: string
  times?: number
}

type PendingUploadAssetFailure = Omit<
  FakeUploadAssetFailure,
  'sourceRevisionHash' | 'uploadId' | 'times'
> & {
  remainingFailures: number
}

type FakeApiState = {
  createSessionBodies: Array<Record<string, unknown>>
  uploadBodies: Array<{
    uploadId: string
    kind: string
    bytes: number
    sha256: string
  }>
  finalizeBodies: Array<Record<string, unknown>>
  finalizedRevisions: Array<{
    conversationId: string
    revisionId: string
    sourceSessionId: string
  }>
  nextUploadId: number
  nextConversationId: number
  nextRevisionId: number
  authMode: 'valid' | 'invalid'
  nextCreateSessionFailure?: FakeApiFailure
  nextUploadAssetFailure?: FakeUploadAssetFailure
  nextFinalizeFailure?: FakeApiFailure
  pendingUploadAssetFailures: Record<string, PendingUploadAssetFailure>
}

const tempDirectories: string[] = []
const activeServers = new Set<Server>()

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      server =>
        new Promise<void>((resolve, reject) => {
          activeServers.delete(server)
          server.close(error => {
            if (error) reject(error)
            else resolve()
          })
        }),
    ),
  )

  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe.sequential('CLI smoke', () => {
  it('warns immediately when sync runs without a stored auth token', async () => {
    const harness = await createCliSmokeHarness()

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Run `howicc login` before syncing conversations.')
    expect(harness.apiState.createSessionBodies).toHaveLength(0)
    expect(harness.apiState.uploadBodies).toHaveLength(0)
    expect(harness.apiState.finalizeBodies).toHaveLength(0)
  })

  it('warns when the stored auth token can no longer be verified', async () => {
    const harness = await createCliSmokeHarness()

    await seedAuthToken(harness)
    harness.apiState.authMode = 'invalid'

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain(
      'The stored CLI token could not be verified. Run `howicc login` again.',
    )
    expect(harness.apiState.createSessionBodies).toHaveLength(0)
    expect(harness.apiState.uploadBodies).toHaveLength(0)
    expect(harness.apiState.finalizeBodies).toHaveLength(0)
  })

  it('syncs a real discovered session, preserves conversation continuity, and skips unchanged revisions', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174010'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Map the current CLI sync behavior',
          assistant: 'I inspected the sync pipeline and summarized the current behavior.',
        },
      ],
    })

    const firstSync = await runCli(harness, ['sync', '--all', '--yes'])

    expect(firstSync.code).toBe(0)
    expectNoCliFailure(firstSync)
    expect(firstSync.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')
    expect(firstSync.stdout).not.toContain('skipped because the revision hash is unchanged')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.uploadBodies).toHaveLength(3)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)
    expect(harness.apiState.finalizeBodies[0]).toMatchObject({
      sourceSessionId: sessionId,
    })
    expect(harness.apiState.finalizeBodies[0]).not.toHaveProperty('conversationId')
    expect(
      getAssetKinds(harness.apiState.createSessionBodies[0]?.assets),
    ).toEqual(['source_bundle', 'canonical_json', 'render_json'])

    const syncedAfterFirstRun = await readSyncedRevisions(harness)
    expect(Object.values(syncedAfterFirstRun)).toHaveLength(1)

    const unchangedSync = await runCli(harness, ['sync', '--all', '--yes'])

    expect(unchangedSync.code).toBe(0)
    expectNoCliFailure(unchangedSync)
    expect(unchangedSync.stdout).toContain('Finished sync run. 0 synced, 1 skipped, 0 failed.')
    expect(unchangedSync.stdout).toContain('Use `howicc sync --force` when you want to re-upload unchanged revisions.')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.uploadBodies).toHaveLength(3)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)

    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Map the current CLI sync behavior',
          assistant: 'I inspected the sync pipeline and summarized the current behavior.',
        },
        {
          user: 'Summarize the gaps in that flow',
          assistant: 'The gaps are around revision continuity, privacy checks, and command-level coverage.',
        },
      ],
    })

    const changedSync = await runCli(harness, ['sync', '--all', '--yes'])

    expect(changedSync.code).toBe(0)
    expectNoCliFailure(changedSync)
    expect(changedSync.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')
    expect(harness.apiState.createSessionBodies).toHaveLength(2)
    expect(harness.apiState.uploadBodies).toHaveLength(6)
    expect(harness.apiState.finalizeBodies).toHaveLength(2)
    expect(harness.apiState.finalizeBodies[1]).toMatchObject({
      sourceSessionId: sessionId,
      conversationId: harness.apiState.finalizedRevisions[0]?.conversationId,
    })

    const syncedAfterSecondRevision = await readSyncedRevisions(harness)
    const syncedRevisions = Object.values(syncedAfterSecondRevision)

    expect(syncedRevisions).toHaveLength(2)
    expect(new Set(syncedRevisions.map(revision => revision.sourceRevisionHash)).size).toBe(2)
    expect(new Set(syncedRevisions.map(revision => revision.conversationId))).toEqual(
      new Set([harness.apiState.finalizedRevisions[0]?.conversationId]),
    )
  })

  it('surfaces unsynced audit state through the real list command', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174011'

    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Review the unsynced CLI sessions',
          assistant: 'I can audit which sessions are new or changed.',
        },
      ],
    })

    const initialList = await runCli(harness, ['list', '--unsynced', '--all'])

    expect(initialList.code).toBe(0)
    expectNoCliFailure(initialList)
    expect(initialList.stdout).toContain('1 never synced')
    expect(initialList.stdout).toContain('Review the unsynced CLI sessions')
    expect(initialList.stdout).toContain('Not synced yet')

    await seedAuthToken(harness)

    const firstSync = await runCli(harness, ['sync', '--all', '--yes'])
    expect(firstSync.code).toBe(0)
    expect(firstSync.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')

    const emptyUnsyncedList = await runCli(harness, ['list', '--unsynced', '--all'])

    expect(emptyUnsyncedList.code).toBe(0)
    expectNoCliFailure(emptyUnsyncedList)
    expect(emptyUnsyncedList.stdout).toContain('No sessions matched the selected filter.')

    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Review the unsynced CLI sessions',
          assistant: 'I can audit which sessions are new or changed.',
        },
        {
          user: 'Now show me only the sessions that changed',
          assistant: 'This session now appears as updated since the last sync.',
        },
      ],
    })

    const updatedUnsyncedList = await runCli(harness, ['list', '--unsynced', '--all'])

    expect(updatedUnsyncedList.code).toBe(0)
    expectNoCliFailure(updatedUnsyncedList)
    expect(updatedUnsyncedList.stdout).toContain('1 updated locally')
    expect(updatedUnsyncedList.stdout).toContain('Updated since last sync')
  })

  it('reports upload session creation failures without storing a synced revision', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174012'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Sync this session even if the API rejects it',
          assistant: 'The sync attempt should surface a clear failure.',
        },
      ],
    })
    harness.apiState.nextCreateSessionFailure = {
      status: 409,
      code: 'upload_conflict',
      error: 'Upload session rejected by API.',
    }

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Finished sync run. 0 synced, 0 skipped, 1 failed.')
    expect(result.stderr).toContain('failed: Upload session rejected by API.')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.uploadBodies).toHaveLength(0)
    expect(harness.apiState.finalizeBodies).toHaveLength(0)
    expect(Object.values(await readSyncedRevisions(harness))).toHaveLength(0)
  })

  it('reports finalize failures after uploading assets without storing a synced revision', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174013'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Finish the sync only if finalize succeeds',
          assistant: 'The finalize step should fail cleanly in this smoke test.',
        },
      ],
    })
    harness.apiState.nextFinalizeFailure = {
      status: 410,
      code: 'upload_expired',
      error: 'The upload session expired before finalize.',
    }

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Finished sync run. 0 synced, 0 skipped, 1 failed.')
    expect(result.stderr).toContain('failed: The upload session expired before finalize.')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.uploadBodies).toHaveLength(3)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)
    expect(Object.values(await readSyncedRevisions(harness))).toHaveLength(0)
  })

  it('blocks sync locally before any upload when privacy pre-flight finds secret material', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174019'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
          assistant: 'This session should never reach the upload API.',
        },
      ],
    })

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Privacy Pre-flight')
    expect(result.stderr).toContain(
      'Blocked this upload because privacy pre-flight found sensitive content.',
    )
    expect(harness.apiState.createSessionBodies).toHaveLength(0)
    expect(harness.apiState.uploadBodies).toHaveLength(0)
    expect(harness.apiState.finalizeBodies).toHaveLength(0)
    expect(Object.values(await readSyncedRevisions(harness))).toHaveLength(0)
  })

  it('retries transient asset upload failures and still completes the sync', async () => {
    const harness = await createCliSmokeHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174016'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId,
      turns: [
        {
          user: 'Retry the asset upload if the storage layer briefly fails',
          assistant: 'The CLI should recover and still finalize the session.',
        },
      ],
    })
    harness.apiState.nextUploadAssetFailure = {
      uploadId: 'upload_1',
      kind: 'render_json',
      status: 500,
      code: 'internal_error',
      error: 'Temporary storage failure.',
      times: 1,
    }

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expectNoCliFailure(result)
    expect(result.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 0 failed.')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.uploadBodies).toHaveLength(4)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)

    const syncedRevisions = Object.values(await readSyncedRevisions(harness))

    expect(syncedRevisions).toHaveLength(1)
    expect(syncedRevisions[0]).toMatchObject({
      sessionId,
    })
  })

  it('continues syncing sibling sessions when one asset upload fails mid-session', async () => {
    const harness = await createCliSmokeHarness()
    const failingSessionId = '123e4567-e89b-42d3-a456-426614174017'
    const healthySessionId = '123e4567-e89b-42d3-a456-426614174018'

    await seedAuthToken(harness)
    await writeSessionTranscript(harness, {
      sessionId: failingSessionId,
      fileTimestamp: '2026-04-01T10:10:00.000Z',
      turns: [
        {
          user: 'Fail one asset upload after some uploads already succeeded',
          assistant: 'This session should fail before finalize and never be recorded as synced.',
        },
      ],
    })
    await writeSessionTranscript(harness, {
      sessionId: healthySessionId,
      fileTimestamp: '2026-04-01T10:00:00.000Z',
      turns: [
        {
          user: 'Keep syncing sibling sessions after the first upload interruption',
          assistant: 'This session should still complete and be recorded.',
        },
      ],
    })
    harness.apiState.nextUploadAssetFailure = {
      uploadId: 'upload_1',
      kind: 'render_json',
      status: 410,
      code: 'upload_expired',
      error: 'The upload session expired before asset upload completed.',
    }

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 1 failed.')
    expect(result.stderr).toContain(
      'failed: The upload session expired before asset upload completed.',
    )
    expect(harness.apiState.createSessionBodies).toHaveLength(2)
    expect(harness.apiState.uploadBodies).toHaveLength(6)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)
    expect(harness.apiState.finalizeBodies[0]).toMatchObject({
      sourceSessionId: healthySessionId,
    })

    const syncedRevisions = Object.values(await readSyncedRevisions(harness))

    expect(syncedRevisions).toHaveLength(1)
    expect(syncedRevisions[0]).toMatchObject({
      sessionId: healthySessionId,
    })
  })

  it('continues syncing healthy sessions when one discovered transcript is malformed', async () => {
    const harness = await createCliSmokeHarness()
    const badSessionId = '123e4567-e89b-42d3-a456-426614174014'
    const goodSessionId = '123e4567-e89b-42d3-a456-426614174015'

    await seedAuthToken(harness)
    await writeBrokenSessionTranscript(harness, {
      sessionId: badSessionId,
      fileTimestamp: '2026-04-01T10:05:00.000Z',
    })
    await writeSessionTranscript(harness, {
      sessionId: goodSessionId,
      fileTimestamp: '2026-04-01T10:00:00.000Z',
      turns: [
        {
          user: 'Sync the valid session even if a neighbor is broken',
          assistant: 'The sync run should still complete for the healthy session.',
        },
      ],
    })

    const result = await runCli(harness, ['sync', '--all', '--yes'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Finished sync run. 1 synced, 0 skipped, 1 failed.')
    expect(result.stderr).toContain('Failed to parse JSONL.')
    expect(harness.apiState.createSessionBodies).toHaveLength(1)
    expect(harness.apiState.finalizeBodies).toHaveLength(1)
    expect(harness.apiState.finalizeBodies[0]).toMatchObject({
      sourceSessionId: goodSessionId,
    })
    expect(Object.values(await readSyncedRevisions(harness))).toHaveLength(1)
  })
})

const createCliSmokeHarness = async (): Promise<CliSmokeHarness> => {
  const claude = await createClaudeFixtureEnvironment('howicc-cli-smoke')
  tempDirectories.push(claude.rootDir)

  const homeDir = path.join(claude.rootDir, 'home')
  const preloadPath = path.join(claude.rootDir, 'openrouter-preload.mjs')
  const storeHelperPath = path.join(claude.rootDir, 'store-helper.ts')

  await Promise.all([
    mkdir(path.join(homeDir, '.config'), { recursive: true }),
    writeFile(preloadPath, buildOpenRouterCatalogPreload()),
    writeFile(storeHelperPath, buildCliStoreHelperScript()),
  ])

  const { server, apiBaseUrl, state } = await startFakeApiServer()

  return {
    rootDir: claude.rootDir,
    homeDir,
    claude,
    preloadPath,
    storeHelperPath,
    apiBaseUrl,
    apiState: state,
    server,
  }
}

const runCli = async (
  harness: CliSmokeHarness,
  args: string[],
): Promise<CliRunResult> =>
  runCliProcess({
    args,
    env: buildCliEnvironment({
      homeDir: harness.homeDir,
      claudeHomeDir: harness.claude.claudeHomeDir,
      apiBaseUrl: harness.apiBaseUrl,
    }),
    preloadPath: harness.preloadPath,
  })

const seedAuthToken = async (harness: CliSmokeHarness) => {
  await runStoreHelper(harness, 'seed-auth', {
    token: 'hwi_test_token',
    user: {
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    },
  })
}

const readSyncedRevisions = async (harness: CliSmokeHarness) =>
  runStoreHelper<Record<string, {
    conversationId: string
    revisionId: string
    sourceRevisionHash: string
    syncedAt: string
    sessionId: string
    provider: string
  }>>(harness, 'get-synced-revisions')

const runStoreHelper = async <T>(
  harness: CliSmokeHarness,
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
  })

  expect(result.code).toBe(0)
  expect(result.stderr).toBe('')

  return JSON.parse(result.stdout) as T
}

const writeSessionTranscript = async (
  harness: CliSmokeHarness,
  input: {
    sessionId: string
    fileTimestamp?: string
    turns: Array<{ user: string; assistant: string }>
  },
) =>
  writeClaudeSessionTranscript(harness.claude, input)

const writeBrokenSessionTranscript = async (
  harness: CliSmokeHarness,
  input: {
    sessionId: string
    fileTimestamp?: string
  },
) =>
  writeBrokenClaudeSessionTranscript(harness.claude, input)

const startFakeApiServer = async (): Promise<{
  server: Server
  apiBaseUrl: string
  state: FakeApiState
}> => {
  const state: FakeApiState = {
    createSessionBodies: [],
    uploadBodies: [],
    finalizeBodies: [],
    finalizedRevisions: [],
    nextUploadId: 1,
    nextConversationId: 1,
    nextRevisionId: 1,
    authMode: 'valid',
    pendingUploadAssetFailures: {},
  }

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    const authorization = request.headers.authorization

    if (authorization !== 'Bearer hwi_test_token') {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: false,
        code: 'cli_token_invalid',
        error: 'Missing or invalid CLI token.',
      }))
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/cli-auth/whoami') {
      if (state.authMode === 'invalid') {
        response.writeHead(401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          success: false,
          code: 'cli_token_invalid',
          error: 'Missing or invalid CLI token.',
        }))
        return
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        user: {
          id: 'user_1',
          email: 'abdallah@example.com',
          name: 'Abdallah',
        },
      }))
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        status: 'ok',
      }))
      return
    }

    if (request.method === 'POST' && requestUrl.pathname === '/uploads/sessions') {
      const body = await readJsonBody<Record<string, unknown>>(request)
      const uploadId = `upload_${state.nextUploadId++}`
      const assets = Array.isArray(body.assets)
        ? body.assets as Array<Record<string, unknown>>
        : []

      state.createSessionBodies.push(body)

      if (
        state.nextUploadAssetFailure &&
        (
          (
            typeof state.nextUploadAssetFailure.sourceRevisionHash === 'string' &&
            body.sourceRevisionHash === state.nextUploadAssetFailure.sourceRevisionHash
          ) ||
          state.nextUploadAssetFailure.uploadId === uploadId
        )
      ) {
        const {
          sourceRevisionHash: _sourceRevisionHash,
          uploadId: _uploadId,
          times,
          ...failure
        } = state.nextUploadAssetFailure
        state.pendingUploadAssetFailures[uploadId] = {
          ...failure,
          remainingFailures: times ?? 1,
        }
        state.nextUploadAssetFailure = undefined
      }

      if (state.nextCreateSessionFailure) {
        const failure = state.nextCreateSessionFailure
        state.nextCreateSessionFailure = undefined
        response.writeHead(failure.status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          success: false,
          code: failure.code,
          error: failure.error,
        }))
        return
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        uploadId,
        assetTargets: assets.map(asset => ({
          kind: asset.kind,
          key: `${uploadId}/${asset.kind}.gz`,
          uploadPath: `/uploads/${uploadId}/assets/${asset.kind}`,
        })),
      }))
      return
    }

    const uploadMatch = requestUrl.pathname.match(/^\/uploads\/([^/]+)\/assets\/([^/]+)$/)

    if (request.method === 'PUT' && uploadMatch) {
      const [, uploadId, kind] = uploadMatch
      const body = await readBody(request)

      state.uploadBodies.push({
        uploadId: uploadId ?? '',
        kind: kind ?? '',
        bytes: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
      })

      const pendingFailure =
        uploadId ? state.pendingUploadAssetFailures[uploadId] : undefined

      if (
        pendingFailure &&
        (!pendingFailure.kind || pendingFailure.kind === kind)
      ) {
        pendingFailure.remainingFailures -= 1

        if (uploadId && pendingFailure.remainingFailures <= 0) {
          delete state.pendingUploadAssetFailures[uploadId]
        }

        response.writeHead(pendingFailure.status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          success: false,
          code: pendingFailure.code,
          error: pendingFailure.error,
        }))
        return
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        uploadId,
        kind,
        key: `${uploadId}/${kind}.gz`,
        bytes: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
      }))
      return
    }

    if (request.method === 'POST' && requestUrl.pathname === '/uploads/finalize') {
      const body = await readJsonBody<Record<string, unknown>>(request)

      state.finalizeBodies.push(body)

      if (state.nextFinalizeFailure) {
        const failure = state.nextFinalizeFailure
        state.nextFinalizeFailure = undefined
        response.writeHead(failure.status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          success: false,
          code: failure.code,
          error: failure.error,
        }))
        return
      }

      const conversationId =
        typeof body.conversationId === 'string'
          ? body.conversationId
          : `conv_${state.nextConversationId++}`
      const revisionId = `rev_${state.nextRevisionId++}`

      state.finalizedRevisions.push({
        conversationId,
        revisionId,
        sourceSessionId:
          typeof body.sourceSessionId === 'string' ? body.sourceSessionId : '',
      })

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        conversationId,
        revisionId,
      }))
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      success: false,
      code: 'not_found',
      error: `Unhandled route: ${request.method} ${requestUrl.pathname}`,
    }))
  })

  activeServers.add(server)

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, '127.0.0.1')
  })

  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Fake API server did not expose a TCP port.')
  }

  return {
    server,
    apiBaseUrl: `http://127.0.0.1:${address.port}`,
    state,
  }
}

const getAssetKinds = (assets: unknown): string[] =>
  Array.isArray(assets)
    ? assets
        .map(asset =>
          asset && typeof asset === 'object' && 'kind' in asset
            ? String(asset.kind)
            : undefined,
        )
        .filter((kind): kind is string => Boolean(kind))
    : []

const expectNoCliFailure = (result: CliRunResult) => {
  expect(result.stderr).not.toContain(' failed:')
  expect(result.stderr).not.toContain(' ✗ ')
}

const readBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

const readJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
  const body = await readBody(request)
  return JSON.parse(body.toString('utf8')) as T
}
