import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClaudeFixtureEnvironment,
  type ClaudeFixtureEnvironment,
  writeBrokenClaudeSessionTranscript,
  writeClaudeSessionTranscript,
} from '../test-support/claude-fixtures'

const createSpinner = (text = '') => {
  const spinner = {
    text,
    start: vi.fn(() => spinner),
    stop: vi.fn(() => spinner),
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

const { profileCommand } = await import('./profile')

describe('profileCommand', () => {
  let fixture: ClaudeFixtureEnvironment | undefined
  let stdout: string[]
  let stderr: string[]
  let originalClaudeConfigDir: string | undefined

  beforeEach(async () => {
    fixture = await createClaudeFixtureEnvironment('howicc-cli-profile')
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

  it('aggregates real local sessions into the profile view and reports parse failures', async () => {
    await writeClaudeSessionTranscript(fixture!, {
      sessionId: '123e4567-e89b-42d3-a456-426614174104',
      fileTimestamp: '2026-04-10T10:00:00.000Z',
      turns: [
        {
          user: 'Audit the CLI testing gaps',
          assistant: 'I read and edited the sync command.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/commands/sync.ts`,
              },
            },
            {
              name: 'Edit',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/commands/sync.ts`,
                old_string: 'before',
                new_string: 'after',
              },
            },
          ],
        },
      ],
    })
    await writeClaudeSessionTranscript(fixture!, {
      sessionId: '123e4567-e89b-42d3-a456-426614174105',
      fileTimestamp: '2026-04-11T10:00:00.000Z',
      turns: [
        {
          user: 'Review the CLI profile output',
          assistant: 'I inspected the profile command and wrote a patch.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/commands/profile.ts`,
              },
            },
            {
              name: 'Write',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/commands/profile.ts`,
              },
            },
          ],
        },
      ],
    })
    await writeBrokenClaudeSessionTranscript(fixture!, {
      sessionId: '123e4567-e89b-42d3-a456-426614174106',
    })

    await profileCommand()

    const output = stdout.join('\n')

    expect(output).toContain('HowiCC Profile')
    expect(output).toContain('2 sessions')
    expect(output).toContain('ACTIVITY')
    expect(output).toContain('PROJECTS')
    expect(output).toContain('TOOLS')
    expect(output).toContain('PRODUCTIVITY')
    expect(output).toContain('MODELS')
    expect(output).toContain('sessions failed to parse')
    expect(output).toContain('Run howicc sync')
    expect(stderr).toEqual([])
  })

  it('shows an empty-state message when there are no local Claude sessions', async () => {
    await profileCommand()

    expect(stdout.join('\n')).toContain('No sessions found in ~/.claude/')
    expect(stderr).toEqual([])
  })
})
