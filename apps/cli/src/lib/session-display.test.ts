import { homedir } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatLocalSessionSyncLabel,
  formatProjectDisplayPath,
  getLocalSessionSyncStatus,
  getSessionStatLabels,
} from './session-display'

describe('session-display', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T10:00:00.000Z'))
  })

  it('collapses deep paths into a readable home-relative label', () => {
    expect(
      formatProjectDisplayPath(
        `${homedir()}/Developer/personal/howicc/apps/cli`,
      ),
    ).toBe('~/Developer/.../apps/cli')
  })

  it('classifies sessions that changed after the last sync', () => {
    const session = { updatedAt: '2026-04-14T09:30:00.000Z' }
    const syncState = {
      latestSyncedRevision: {
        provider: 'claude_code' as const,
        sessionId: 'session-123',
        conversationId: 'conv_123',
        revisionId: 'rev_123',
        sourceRevisionHash: 'hash_older',
        syncedAt: '2026-04-14T08:30:00.000Z',
      },
    }

    expect(getLocalSessionSyncStatus(session, syncState)).toBe('updated_since_sync')
    expect(formatLocalSessionSyncLabel(session, syncState)).toBe(
      'Updated since last sync (30m ago)',
    )
  })

  it('treats an exact synced revision as synced even when a newer revision exists', () => {
    const session = { updatedAt: '2026-04-14T09:30:00.000Z' }
    const syncState = {
      currentSyncedRevision: {
        provider: 'claude_code' as const,
        sessionId: 'session-123',
        conversationId: 'conv_123',
        revisionId: 'rev_older',
        sourceRevisionHash: 'hash_current',
        syncedAt: '2026-04-14T08:00:00.000Z',
      },
      latestSyncedRevision: {
        provider: 'claude_code' as const,
        sessionId: 'session-123',
        conversationId: 'conv_123',
        revisionId: 'rev_newer',
        sourceRevisionHash: 'hash_newer',
        syncedAt: '2026-04-14T09:00:00.000Z',
      },
    }

    expect(getLocalSessionSyncStatus(session, syncState)).toBe('synced')
    expect(formatLocalSessionSyncLabel(session, syncState)).toBe('Synced 2h ago')
  })

  it('summarizes digest stats into compact labels', () => {
    expect(
      getSessionStatLabels({
        toolRunCount: 14,
        filesChanged: ['a.ts', 'b.ts'],
        languages: { ts: 4, md: 1 },
        gitCommits: 2,
        prLinks: [{ number: 42, repository: 'abdallah/howicc', url: 'https://example.com' }],
        sessionType: 'building',
      }),
    ).toEqual(['14 tools', '2 files', 'ts(4) md(1)', '2 commits', 'PR #42', 'building'])
  })
})
