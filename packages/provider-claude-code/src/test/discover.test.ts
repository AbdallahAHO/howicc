import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverClaudeSessions } from '../discover'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('discoverClaudeSessions', () => {
  it('discovers only valid top-level session transcripts and ignores nested or invalid files', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)
    const subagentDirectory = path.join(projectDirectory, sessionId, 'subagents')

    await mkdir(subagentDirectory, { recursive: true })

    await writeFile(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          parentUuid: null,
          timestamp: '2026-04-01T10:00:00.000Z',
          slug: 'gentle-river',
          cwd: '/tmp/project',
          gitBranch: 'main',
          message: { role: 'user', content: 'hello world' },
        }),
      ].join('\n'),
    )

    await writeFile(
      path.join(projectDirectory, 'not-a-session.jsonl'),
      JSON.stringify({
        type: 'user',
        uuid: 'u2',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:02.000Z',
        message: { role: 'user', content: 'ignore me' },
      }),
    )

    await writeFile(
      path.join(subagentDirectory, 'agent-a1.jsonl'),
      JSON.stringify({
        type: 'user',
        uuid: 's1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:01.000Z',
        isSidechain: true,
        message: { role: 'user', content: 'nested' },
      }),
    )

    const sessions = await discoverClaudeSessions({ claudeHomeDir })

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      sessionId,
      projectKey: 'project-key',
      projectPath: '/tmp/project',
      gitBranch: 'main',
      slug: 'gentle-river',
      firstPromptPreview: 'hello world',
    })
  })
})
