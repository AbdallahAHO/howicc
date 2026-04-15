import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SourceBundle } from '@howicc/parser-core'
import type { RenderDocument } from '@howicc/render'
import { buildRedactedRenderPreview, inspectSessionPrivacy } from './privacy'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('inspectSessionPrivacy', () => {
  it('inspects both source-bundle inputs and render output before sync', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-cli-privacy-'))
    tempDirectories.push(cwd)

    const transcriptPath = join(cwd, 'session.jsonl')
    await writeFile(
      transcriptPath,
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456\n',
    )

    const bundle: SourceBundle = {
      kind: 'agent_source_bundle',
      version: 1,
      provider: 'claude_code',
      sessionId: 'session_123',
      projectKey: 'project-key',
      projectPath: cwd,
      capturedAt: '2026-04-15T10:00:00.000Z',
      files: [
        {
          id: 'file_1',
          relPath: 'session.jsonl',
          absolutePath: transcriptPath,
          kind: 'transcript',
          sha256: 'hash_1',
          bytes: 52,
        },
      ],
      manifest: {
        transcript: {
          relPath: 'session.jsonl',
          absolutePath: transcriptPath,
        },
        cwd,
        planFiles: [],
        toolResults: [],
        subagents: [],
        remoteAgents: [],
        warnings: [],
      },
    }

    const render: RenderDocument = {
      kind: 'render_document',
      schemaVersion: 1,
      session: {
        sessionId: 'session_123',
        title: 'Privacy inspection sample',
        provider: 'claude_code',
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:05:00.000Z',
        stats: {
          messageCount: 1,
          toolRunCount: 0,
          activityGroupCount: 0,
        },
      },
      blocks: [
        {
          type: 'message',
          id: 'msg_1',
          role: 'user',
          text: 'See /Users/abdallah/Developer/personal/howicc/apps/cli/src/index.ts',
        },
      ],
    }

    const privacy = await inspectSessionPrivacy({ bundle, render })

    expect(privacy.status).toBe('block')
    expect(privacy.sourceInspection.summary.blocks).toBeGreaterThan(0)
    expect(privacy.renderInspection.summary.reviews).toBeGreaterThan(0)
  })
})

describe('buildRedactedRenderPreview', () => {
  it('redacts preview lines before they are shown to the user', () => {
    const render: RenderDocument = {
      kind: 'render_document',
      schemaVersion: 1,
      session: {
        sessionId: 'session_123',
        title: 'Preview sample',
        provider: 'claude_code',
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:05:00.000Z',
        stats: {
          messageCount: 2,
          toolRunCount: 0,
          activityGroupCount: 0,
        },
      },
      blocks: [
        {
          type: 'message',
          id: 'msg_1',
          role: 'user',
          text: 'Email abdallah@company.com and inspect /Users/abdallah/project',
        },
        {
          type: 'message',
          id: 'msg_2',
          role: 'assistant',
          text: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
        },
      ],
    }

    const preview = buildRedactedRenderPreview(render)
    const output = preview.lines.join('\n')

    expect(output).toContain('<redacted-email>')
    expect(output).toContain('/Users/<redacted>/project')
    expect(output).toContain('Bearer <redacted>')
    expect(output).not.toContain('abdallah@company.com')
    expect(output).not.toContain('/Users/abdallah/project')
    expect(output).not.toContain('abcdefghijklmnopqrstuvwxyz123456')
  })
})
