import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClaudeFixtureEnvironment,
  type ClaudeFixtureEnvironment,
  writeClaudeSessionTranscript,
} from '../test-support/claude-fixtures'

const createSpinner = (text = '') => {
  const spinner = {
    text,
    start: vi.fn(() => spinner),
    stop: vi.fn(() => spinner),
    fail: vi.fn(() => spinner),
  }

  return spinner
}

const mocks = vi.hoisted(() => ({
  getPricingCatalog: vi.fn(),
  ora: vi.fn((text?: string) => createSpinner(text ?? '')),
}))

vi.mock('../lib/claude', async () => {
  const actual = await vi.importActual<typeof import('../lib/claude')>('../lib/claude')

  return {
    ...actual,
    getPricingCatalog: mocks.getPricingCatalog,
  }
})

vi.mock('ora', () => ({
  default: mocks.ora,
}))

const { inspectCommand } = await import('./inspect')

describe('inspectCommand', () => {
  let fixture: ClaudeFixtureEnvironment | undefined
  let stdout: string[]
  let stderr: string[]
  let originalClaudeConfigDir: string | undefined

  beforeEach(async () => {
    fixture = await createClaudeFixtureEnvironment('howicc-cli-inspect')
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = fixture.claudeHomeDir

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

    mocks.getPricingCatalog.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
    }

    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()

    await fixture?.cleanup()
  })

  it('renders a real local session through the canonical pipeline', async () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174101'

    await writeClaudeSessionTranscript(fixture!, {
      sessionId,
      turns: [
        {
          user: 'Inspect the local CLI quality gaps',
          assistant: 'I read the entrypoint and updated the sync coverage.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/index.ts`,
              },
            },
            {
              name: 'Edit',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/index.ts`,
                old_string: 'old',
                new_string: 'new',
              },
            },
          ],
        },
      ],
    })

    await inspectCommand(sessionId)

    const output = stdout.join('\n')

    expect(output).toContain('TIMELINE')
    expect(output).toContain('Read')
    expect(output).toContain('Edit')
    expect(output).toContain('FILES CHANGED')
    expect(output).toContain('apps/cli/src/index.ts')
    expect(output).toContain('Session type:')
    expect(stderr).toEqual([])
  })

  it('reports when the requested session is not available locally', async () => {
    await inspectCommand('missing-session')

    const sessionSpinner = mocks.ora.mock.results[0]?.value

    expect(sessionSpinner?.fail).toHaveBeenCalledWith(
      'Session missing-session was not found in your local Claude storage.',
    )
  })
})
