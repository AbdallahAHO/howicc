import { describe, expect, it } from 'vitest'
import type { DiscoveredSession } from '@howicc/parser-core'
import type { ParsedRawEntry } from '../jsonl'
import { buildSessionMetadata } from '../parse/metadata'

const session: DiscoveredSession = {
  provider: 'claude_code',
  sessionId: 'session_1',
  projectKey: 'project-key',
  projectPath: '/workspace/project',
  transcriptPath: '/workspace/project/session_1.jsonl',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:10:00.000Z',
  sizeBytes: 1024,
  firstPromptPreview: '[Image #13] still',
  gitBranch: 'main',
  slug: 'session-slug',
}

const entry = (index: number, raw: Record<string, unknown>): ParsedRawEntry => ({
  index,
  raw,
})

describe('buildSessionMetadata', () => {
  it('prefers the first substantive prompt from the active thread over image placeholders', () => {
    const entries = [
      entry(0, {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-04-01T10:00:00.000Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Set up SSH access for the Hetzner box',
            },
          ],
        },
        cwd: '/workspace/project',
        gitBranch: 'main',
        slug: 'session-slug',
      }),
      entry(1, {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u1',
        timestamp: '2026-04-01T10:01:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Checking the SSH config.' }],
        },
      }),
      entry(2, {
        type: 'last-prompt',
        timestamp: '2026-04-01T10:09:00.000Z',
        lastPrompt: '[Image #13] still',
      }),
    ]

    const metadata = buildSessionMetadata(entries, entries.slice(0, 2), session)

    expect(metadata.title).toBe('Set up SSH access for the Hetzner box')
    expect(metadata.gitBranch).toBe('main')
  })
})
