import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

type CliReadOnlyHarness = {
  rootDir: string
  homeDir: string
  preloadPath: string
  storeHelperPath: string
  claude: ClaudeFixtureEnvironment
}

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe.sequential('CLI read-only smoke', () => {
  it('shows the landing screen when invoked without a command', async () => {
    const harness = await createReadOnlyHarness()

    const result = await runCli(harness, [])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('HowiCC')
    expect(result.stdout).toContain('howicc login')
    expect(result.stdout).toContain('howicc list --unsynced')
    expect(result.stdout).toContain('howicc profile')
    expect(result.stdout).toContain('howicc preview')
    expect(result.stderr).toBe('')
  })

  it('reports unknown commands through the real Commander surface', async () => {
    const harness = await createReadOnlyHarness()

    const result = await runCli(harness, ['wat'])
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')

    expect(result.code).toBe(1)
    expect(output).toContain("unknown command 'wat'")
    expect(output).toContain('Usage: howicc [options] [command]')
  })

  it('rejects unsupported export formats before running the command', async () => {
    const harness = await createReadOnlyHarness()

    const result = await runCli(harness, ['export', 'session_1', '--format', 'markdown'])
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')

    expect(result.code).toBe(1)
    expect(output).toContain('Format must be one of: bundle, canonical, render.')
  })

  it('rejects invalid numeric option values before the command executes', async () => {
    const harness = await createReadOnlyHarness()

    const invalidList = await runCli(harness, ['list', '--limit', '0'])
    const invalidSync = await runCli(harness, ['sync', '--recent', 'nope'])
    const listOutput = [invalidList.stdout, invalidList.stderr].filter(Boolean).join('\n')
    const syncOutput = [invalidSync.stdout, invalidSync.stderr].filter(Boolean).join('\n')

    expect(invalidList.code).toBe(1)
    expect(listOutput).toContain('Value must be a positive integer.')
    expect(invalidSync.code).toBe(1)
    expect(syncOutput).toContain('Value must be a positive integer.')
  })

  it('renders synced local sessions through the spawned list command', async () => {
    const harness = await createReadOnlyHarness()
    const syncedSessionId = '123e4567-e89b-42d3-a456-426614174201'
    const unsyncedSessionId = '123e4567-e89b-42d3-a456-426614174202'

    await writeClaudeSessionTranscript(harness.claude, {
      sessionId: syncedSessionId,
      fileTimestamp: '2026-04-15T09:00:00.000Z',
      turns: [
        {
          user: 'Review the already synced CLI session',
          assistant: 'This session should appear in the synced filter.',
        },
      ],
    })
    await writeClaudeSessionTranscript(harness.claude, {
      sessionId: unsyncedSessionId,
      fileTimestamp: '2026-04-14T09:00:00.000Z',
      turns: [
        {
          user: 'Review the unsynced CLI session',
          assistant: 'This session should stay out of the synced filter.',
        },
      ],
    })
    await runStoreHelper(harness, 'seed-synced-session', {
      sessionId: syncedSessionId,
      conversationId: 'conv_synced',
      revisionId: 'rev_synced',
      syncedAt: '2026-04-15T09:30:00.000Z',
    })

    const result = await runCli(harness, ['list', '--synced', '--all'])

    expect(result.code).toBe(0)
    expectNoCliFailure(result)
    expect(result.stdout).toContain('Showing all 1 matching sessions (2 discovered total)')
    expect(result.stdout).toContain('1 already synced')
    expect(result.stdout).toContain('Review the already synced CLI session')
    expect(result.stdout).not.toContain('Review the unsynced CLI session')
  })

  it('inspects one local session end to end through the spawned CLI', async () => {
    const harness = await createReadOnlyHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174203'

    await writeClaudeSessionTranscript(harness.claude, {
      sessionId,
      turns: [
        {
          user: 'Inspect the CLI timeline end to end',
          assistant: 'I traced the timeline, tools, and changed files.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: path.join(harness.claude.projectDir, 'apps/cli/src/index.ts'),
              },
            },
            {
              name: 'Edit',
              input: {
                file_path: path.join(harness.claude.projectDir, 'apps/cli/src/index.ts'),
                old_string: 'old',
                new_string: 'new',
              },
            },
          ],
        },
      ],
    })

    const result = await runCli(harness, ['inspect', sessionId])

    expect(result.code).toBe(0)
    expectNoCliFailure(result)
    expect(result.stdout).toContain('TIMELINE')
    expect(result.stdout).toContain('Read')
    expect(result.stdout).toContain('Edit')
    expect(result.stdout).toContain('FILES CHANGED')
    expect(result.stdout).toContain('apps/cli/src/index.ts')
    expect(result.stdout).toContain('Session type:')
  })

  it('renders a redacted privacy preview through the spawned CLI', async () => {
    const harness = await createReadOnlyHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174208'

    await writeClaudeSessionTranscript(harness.claude, {
      sessionId,
      turns: [
        {
          user: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
          assistant: 'Review /Users/abdallah/Developer/personal/howicc/apps/cli/src/index.ts',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: '/Users/abdallah/Developer/personal/howicc/apps/cli/src/index.ts',
              },
            },
          ],
        },
      ],
    })

    const result = await runCli(harness, ['preview', sessionId])

    expect(result.code).toBe(0)
    expectNoCliFailure(result)
    expect(result.stdout).toContain('HowiCC Preview')
    expect(result.stdout).toContain('Render Preview')
    expect(result.stdout).toContain('Bearer <redacted>')
    expect(result.stdout).toContain('/Users/<redacted>/Developer/personal/howicc/apps/cli/src/index.ts')
    expect(result.stdout).not.toContain('abcdefghijklmnopqrstuvwxyz123456')
    expect(result.stdout).not.toContain('/Users/abdallah/Developer/personal/howicc/apps/cli/src/index.ts')
  })

  it('exports render JSON to a file from the spawned CLI', async () => {
    const harness = await createReadOnlyHarness()
    const sessionId = '123e4567-e89b-42d3-a456-426614174204'
    const outputPath = path.join(harness.rootDir, 'render-export.json')

    await writeClaudeSessionTranscript(harness.claude, {
      sessionId,
      turns: [
        {
          user: 'Export this session as render JSON',
          assistant: 'I prepared the render document for export.',
        },
      ],
    })

    const result = await runCli(harness, [
      'export',
      sessionId,
      '--format',
      'render',
      '--output',
      outputPath,
    ])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain(`Wrote render export to ${outputPath}`)
    expect(result.stderr).toBe('')

    const exported = JSON.parse(await readFile(outputPath, 'utf8')) as {
      session: {
        title: string
      }
      blocks: unknown[]
    }

    expect(exported.session.title).toContain('Export this session as render JSON')
    expect(exported.blocks.length).toBeGreaterThan(0)
  })

  it('aggregates local sessions in the spawned profile command', async () => {
    const harness = await createReadOnlyHarness()

    await writeClaudeSessionTranscript(harness.claude, {
      sessionId: '123e4567-e89b-42d3-a456-426614174205',
      turns: [
        {
          user: 'Profile the CLI read path',
          assistant: 'I read the sync command and summarized it.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: path.join(harness.claude.projectDir, 'apps/cli/src/commands/sync.ts'),
              },
            },
          ],
        },
      ],
    })
    await writeClaudeSessionTranscript(harness.claude, {
      sessionId: '123e4567-e89b-42d3-a456-426614174206',
      turns: [
        {
          user: 'Profile the CLI write path',
          assistant: 'I edited the profile command and summarized the changes.',
          toolCalls: [
            {
              name: 'Write',
              input: {
                file_path: path.join(harness.claude.projectDir, 'apps/cli/src/commands/profile.ts'),
              },
            },
          ],
        },
      ],
    })
    await writeBrokenClaudeSessionTranscript(harness.claude, {
      sessionId: '123e4567-e89b-42d3-a456-426614174207',
    })

    const result = await runCli(harness, ['profile'])

    expect(result.code).toBe(0)
    expectNoCliFailure(result)
    expect(result.stdout).toContain('HowiCC Profile')
    expect(result.stdout).toContain('2 sessions')
    expect(result.stdout).toContain('ACTIVITY')
    expect(result.stdout).toContain('TOOLS')
    expect(result.stdout).toContain('PRODUCTIVITY')
    expect(result.stdout).toContain('MODELS')
    expect(result.stdout).toContain('1 sessions failed to parse')
    expect(result.stdout).toContain('Run howicc sync to upload sessions to howi.cc')
  })
})

const createReadOnlyHarness = async (): Promise<CliReadOnlyHarness> => {
  const claude = await createClaudeFixtureEnvironment('howicc-cli-read-only')
  tempDirectories.push(claude.rootDir)

  const homeDir = path.join(claude.rootDir, 'home')
  const preloadPath = path.join(claude.rootDir, 'openrouter-preload.mjs')
  const storeHelperPath = path.join(claude.rootDir, 'store-helper.ts')

  await Promise.all([
    mkdir(path.join(homeDir, '.config'), { recursive: true }),
    writeFile(preloadPath, buildOpenRouterCatalogPreload()),
    writeFile(storeHelperPath, buildCliStoreHelperScript()),
  ])

  return {
    rootDir: claude.rootDir,
    homeDir,
    preloadPath,
    storeHelperPath,
    claude,
  }
}

const runCli = async (
  harness: CliReadOnlyHarness,
  args: string[],
) =>
  runCliProcess({
    args,
    env: buildCliEnvironment({
      homeDir: harness.homeDir,
      claudeHomeDir: harness.claude.claudeHomeDir,
    }),
    preloadPath: harness.preloadPath,
  })

const runStoreHelper = async <T>(
  harness: CliReadOnlyHarness,
  action: string,
  payload?: unknown,
): Promise<T> => {
  const result = await runTsxScript({
    scriptPath: harness.storeHelperPath,
    args: [action, payload === undefined ? 'null' : JSON.stringify(payload)],
    env: buildCliEnvironment({
      homeDir: harness.homeDir,
      claudeHomeDir: harness.claude.claudeHomeDir,
    }),
  })

  expect(result.code).toBe(0)
  expect(result.stderr).toBe('')

  return JSON.parse(result.stdout) as T
}

const expectNoCliFailure = (result: CliRunResult) => {
  expect(result.stderr).not.toContain(' failed:')
  expect(result.stderr).not.toContain(' ✗ ')
}
