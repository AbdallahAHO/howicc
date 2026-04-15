import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildClaudeSourceBundle } from '../bundle'
import type { DiscoveredSession } from '@howicc/parser-core'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('buildClaudeSourceBundle', () => {
  it('collects transcript, tool-results, subagents, and project-local plans', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-under-test')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-1'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)
    const sessionDirectory = path.join(projectDirectory, sessionId)
    const plansDirectory = path.join(projectPath, '.howicc-plans')

    await mkdir(path.join(projectPath, '.claude'), { recursive: true })
    await mkdir(path.join(sessionDirectory, 'tool-results'), { recursive: true })
    await mkdir(path.join(sessionDirectory, 'subagents'), { recursive: true })
    await mkdir(plansDirectory, { recursive: true })

    await writeFile(
      path.join(projectPath, '.claude', 'settings.local.json'),
      JSON.stringify({ plansDirectory: '.howicc-plans' }),
    )

    await writeFile(
      transcriptPath,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:00.000Z',
        slug: 'gentle-river',
        cwd: projectPath,
        gitBranch: 'main',
        message: { role: 'user', content: 'hello world' },
      }),
    )

    await writeFile(
      path.join(sessionDirectory, 'tool-results', 'tool.txt'),
      'tool output',
    )

    await writeFile(
      path.join(sessionDirectory, 'subagents', 'agent-a1.jsonl'),
      JSON.stringify({
        type: 'user',
        uuid: 's1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:01.000Z',
        isSidechain: true,
        message: { role: 'user', content: 'nested' },
      }),
    )

    await writeFile(
      path.join(sessionDirectory, 'subagents', 'agent-a1.meta.json'),
      JSON.stringify({ agentType: 'Explore', description: 'Explore codebase' }),
    )

    await writeFile(path.join(plansDirectory, 'gentle-river.md'), '# Plan\n\nDo a thing')

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:00.000Z',
      sizeBytes: 100,
      slug: 'gentle-river',
      gitBranch: 'main',
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })

    expect(bundle.files.map(file => file.kind)).toEqual(
      expect.arrayContaining([
        'transcript',
        'tool_result',
        'subagent_transcript',
        'subagent_meta',
        'plan_file',
      ]),
    )

    expect(bundle.manifest.slug).toBe('gentle-river')
    expect(bundle.manifest.planFiles).toHaveLength(1)
    expect(bundle.manifest.subagents[0]).toMatchObject({
      agentId: 'a1',
      agentType: 'Explore',
      description: 'Explore codebase',
    })
  })

  it('preserves nested sidecar paths so basename collisions do not overwrite each other', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-sidecars')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-sidecars'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)
    const sessionDirectory = path.join(projectDirectory, sessionId)

    await mkdir(path.join(sessionDirectory, 'tool-results', 'worker-a'), {
      recursive: true,
    })
    await mkdir(path.join(sessionDirectory, 'tool-results', 'worker-b'), {
      recursive: true,
    })
    await mkdir(path.join(sessionDirectory, 'subagents', 'team-a'), {
      recursive: true,
    })
    await mkdir(path.join(sessionDirectory, 'remote-agents', 'region-a'), {
      recursive: true,
    })
    await mkdir(path.join(projectPath, '.claude'), { recursive: true })

    await writeFile(
      transcriptPath,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:00.000Z',
        slug: 'gentle-river',
        cwd: projectPath,
        gitBranch: 'main',
        message: { role: 'user', content: 'hello world' },
      }),
    )

    await writeFile(
      path.join(sessionDirectory, 'tool-results', 'worker-a', 'output.txt'),
      'worker a',
    )
    await writeFile(
      path.join(sessionDirectory, 'tool-results', 'worker-b', 'output.txt'),
      'worker b',
    )
    await writeFile(
      path.join(sessionDirectory, 'subagents', 'team-a', 'agent-a1.jsonl'),
      JSON.stringify({
        type: 'user',
        uuid: 's1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:01.000Z',
        isSidechain: true,
        message: { role: 'user', content: 'nested' },
      }),
    )
    await writeFile(
      path.join(sessionDirectory, 'subagents', 'team-a', 'agent-a1.meta.json'),
      JSON.stringify({ agentType: 'Explore', description: 'Nested metadata' }),
    )
    await writeFile(
      path.join(sessionDirectory, 'remote-agents', 'region-a', 'agent.json'),
      JSON.stringify({ region: 'region-a' }),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:00.000Z',
      sizeBytes: 100,
      slug: 'gentle-river',
      gitBranch: 'main',
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const relPaths = bundle.files.map(file => file.relPath)

    expect(new Set(relPaths).size).toBe(relPaths.length)
    expect(relPaths).toEqual(
      expect.arrayContaining([
        path.join(sessionId, 'tool-results', 'worker-a', 'output.txt'),
        path.join(sessionId, 'tool-results', 'worker-b', 'output.txt'),
        path.join(sessionId, 'subagents', 'team-a', 'agent-a1.jsonl'),
        path.join(sessionId, 'subagents', 'team-a', 'agent-a1.meta.json'),
        path.join(sessionId, 'remote-agents', 'region-a', 'agent.json'),
      ]),
    )
    expect(bundle.manifest.subagents[0]).toMatchObject({
      transcriptRelPath: path.join(
        sessionId,
        'subagents',
        'team-a',
        'agent-a1.jsonl',
      ),
      metaRelPath: path.join(
        sessionId,
        'subagents',
        'team-a',
        'agent-a1.meta.json',
      ),
    })
  })
})
