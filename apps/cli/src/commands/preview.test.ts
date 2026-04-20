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
  ora: vi.fn((text?: string) => createSpinner(text ?? '')),
}))

vi.mock('ora', () => ({
  default: mocks.ora,
}))

const { previewCommand } = await import('./preview')

describe('previewCommand', () => {
  let fixture: ClaudeFixtureEnvironment | undefined
  let stdout: string[]
  let stderr: string[]
  let originalClaudeConfigDir: string | undefined

  beforeEach(async () => {
    fixture = await createClaudeFixtureEnvironment('howicc-cli-preview')
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = fixture.claudeHomeDir

    stdout = []
    stderr = []

    vi.spyOn(console, 'log').mockImplementation((...args) => {
      stdout.push(args.join(' '))
    })
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      stderr.push(args.join(' '))
    })
  })

  afterEach(async () => {
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
    }

    vi.restoreAllMocks()
    vi.clearAllMocks()

    await fixture?.cleanup()
  })

  it('shows a redacted render preview plus privacy findings for a real local session', async () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174301'

    await writeClaudeSessionTranscript(fixture!, {
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

    await previewCommand(sessionId)

    const output = stdout.join('\n')

    expect(output).toContain('HowiCC Preview')
    expect(output).toContain('Findings')
    expect(output).toContain('Upload-safe Preview')
    expect(output).toContain('Sanitized')
    expect(output).toContain('Bearer <redacted>')
    expect(output).toContain('/Users/<redacted>/Developer/personal/howicc/apps/cli/src/index.ts')
    expect(output).toContain('Default sync will upload the sanitized version shown above.')
    expect(output).not.toContain('abcdefghijklmnopqrstuvwxyz123456')
    expect(output).not.toContain('/Users/abdallah/Developer/personal/howicc/apps/cli/src/index.ts')
    expect(stderr).toEqual([])
  })

  it('reports when the requested session is not available locally', async () => {
    await previewCommand('missing-session')

    const sessionSpinner = mocks.ora.mock.results[0]?.value

    expect(sessionSpinner?.fail).toHaveBeenCalledWith(
      'Session missing-session was not found in your local Claude storage.',
    )
  })
})
