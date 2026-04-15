import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClaudeFixtureEnvironment,
  type ClaudeFixtureEnvironment,
  writeClaudeSessionTranscript,
} from '../test-support/claude-fixtures'

const { exportCommand } = await import('./export')

describe('exportCommand', () => {
  let fixture: ClaudeFixtureEnvironment | undefined
  let outputDirectory: string | undefined
  let stdoutChunks: string[]
  let stderr: string[]
  let originalClaudeConfigDir: string | undefined

  beforeEach(async () => {
    fixture = await createClaudeFixtureEnvironment('howicc-cli-export')
    outputDirectory = await mkdtemp(join(tmpdir(), 'howicc-cli-export-output-'))
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = fixture.claudeHomeDir

    stdoutChunks = []
    stderr = []

    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      return true
    }) as typeof process.stdout.write)
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

    await Promise.all([
      fixture?.cleanup(),
      outputDirectory ? rm(outputDirectory, { recursive: true, force: true }) : Promise.resolve(),
    ])
  })

  it('writes the default canonical export to stdout for a real local session', async () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174102'

    await writeClaudeSessionTranscript(fixture!, {
      sessionId,
      turns: [
        {
          user: 'Export this session in canonical form',
          assistant: 'I inspected the relevant file before exporting.',
          toolCalls: [
            {
              name: 'Read',
              input: {
                file_path: `${fixture!.projectDir}/apps/cli/src/index.ts`,
              },
            },
          ],
        },
      ],
    })

    await exportCommand(sessionId)

    const output = stdoutChunks.join('')

    expect(output).toContain('"provider": "claude_code"')
    expect(output).toContain(`"sessionId": "${sessionId}"`)
    expect(output).toContain('"events"')
    expect(stderr).toEqual([])
  })

  it('writes an explicit render export to the requested file path', async () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174103'
    const outputPath = join(outputDirectory!, 'session-render.json')

    await writeClaudeSessionTranscript(fixture!, {
      sessionId,
      turns: [
        {
          user: 'Export this session in render form',
          assistant: 'The render document is ready.',
        },
      ],
    })

    await exportCommand(sessionId, { format: 'render', output: outputPath })

    const outputFile = await readFile(outputPath, 'utf8')

    expect(outputFile).toContain('"kind": "render_document"')
    expect(outputFile).toContain(sessionId)
  })

  it('reports a missing local session instead of writing output', async () => {
    await exportCommand('missing-session')

    expect(stdoutChunks).toEqual([])
    expect(stderr.join('\n')).toContain(
      'Session missing-session was not found in your local Claude storage.',
    )
  })
})
