import { describe, expect, it } from 'vitest'
import type { DiscoveredSession } from '@howicc/parser-core'
import { selectDefaultSessionsForSync, selectSessionsForSync, shouldSkipSessionSync } from './sync'

const createSession = (sessionId: string, updatedAt: string): DiscoveredSession => ({
  provider: 'claude_code',
  sessionId,
  projectKey: 'project-key',
  projectPath: '/Users/abdallah/Developer/personal/howicc',
  transcriptPath: `/tmp/${sessionId}.jsonl`,
  updatedAt,
  sizeBytes: 1,
})

describe('selectSessionsForSync', () => {
  const sessions = [
    createSession('older', '2026-04-08T08:00:00.000Z'),
    createSession('newest', '2026-04-10T08:00:00.000Z'),
    createSession('middle', '2026-04-09T08:00:00.000Z'),
  ]

  it('sorts sessions by most recent update time and applies the default limit', () => {
    expect(selectSessionsForSync({ sessions }).map(session => session.sessionId)).toEqual([
      'newest',
      'middle',
      'older',
    ])
  })

  it('filters to a requested session id when one is provided', () => {
    expect(
      selectSessionsForSync({ sessions, sessionId: 'middle' }).map(session => session.sessionId),
    ).toEqual(['middle'])
  })

  it('returns all sessions when requested explicitly', () => {
    expect(
      selectSessionsForSync({ sessions, all: true }).map(session => session.sessionId),
    ).toEqual(['newest', 'middle', 'older'])
  })
})

describe('selectDefaultSessionsForSync', () => {
  const sessions = [
    createSession('older', '2026-04-08T08:00:00.000Z'),
    createSession('newest', '2026-04-10T08:00:00.000Z'),
    createSession('middle', '2026-04-09T08:00:00.000Z'),
  ]

  it('prefers sessions that are new or updated since the last sync', () => {
    const syncStates = {
      older: {
        currentSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'older',
          conversationId: 'conv_older',
          revisionId: 'rev_older',
          sourceRevisionHash: 'hash_older',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'older',
          conversationId: 'conv_older',
          revisionId: 'rev_older',
          sourceRevisionHash: 'hash_older',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
      },
      middle: {
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'middle',
          conversationId: 'conv_middle',
          revisionId: 'rev_middle',
          sourceRevisionHash: 'hash_middle',
          syncedAt: '2026-04-08T09:00:00.000Z',
        },
      },
    }

    expect(
      selectDefaultSessionsForSync({
        sessions,
        getSyncState: session => syncStates[session.sessionId as keyof typeof syncStates],
        limit: 5,
      }).map(session => session.sessionId),
    ).toEqual(['newest', 'middle'])
  })

  it('falls back to the most recent sessions when everything appears up to date', () => {
    const syncStates = {
      older: {
        currentSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'older',
          conversationId: 'conv_older',
          revisionId: 'rev_older',
          sourceRevisionHash: 'hash_older',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'older',
          conversationId: 'conv_older',
          revisionId: 'rev_older',
          sourceRevisionHash: 'hash_older',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
      },
      middle: {
        currentSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'middle',
          conversationId: 'conv_middle',
          revisionId: 'rev_middle',
          sourceRevisionHash: 'hash_middle',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'middle',
          conversationId: 'conv_middle',
          revisionId: 'rev_middle',
          sourceRevisionHash: 'hash_middle',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
      },
      newest: {
        currentSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'newest',
          conversationId: 'conv_newest',
          revisionId: 'rev_newest',
          sourceRevisionHash: 'hash_newest',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'newest',
          conversationId: 'conv_newest',
          revisionId: 'rev_newest',
          sourceRevisionHash: 'hash_newest',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
      },
    }

    expect(
      selectDefaultSessionsForSync({
        sessions,
        getSyncState: session => syncStates[session.sessionId as keyof typeof syncStates],
        limit: 2,
      }).map(session => session.sessionId),
    ).toEqual(['newest', 'middle'])
  })

  it('treats a session as synced when the current revision was uploaded before', () => {
    const sessions = [
      createSession('current', '2026-04-10T08:00:00.000Z'),
      createSession('pending', '2026-04-11T08:00:00.000Z'),
    ]

    const syncStates = {
      current: {
        currentSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'current',
          conversationId: 'conv_current',
          revisionId: 'rev_current_old',
          sourceRevisionHash: 'hash_current',
          syncedAt: '2026-04-09T09:00:00.000Z',
        },
        latestSyncedRevision: {
          provider: 'claude_code' as const,
          sessionId: 'current',
          conversationId: 'conv_current',
          revisionId: 'rev_current_new',
          sourceRevisionHash: 'hash_newer',
          syncedAt: '2026-04-10T09:00:00.000Z',
        },
      },
    }

    expect(
      selectDefaultSessionsForSync({
        sessions,
        getSyncState: session => syncStates[session.sessionId as keyof typeof syncStates],
        limit: 5,
      }).map(session => session.sessionId),
    ).toEqual(['pending'])
  })
})

describe('shouldSkipSessionSync', () => {
  it('skips unchanged revisions when force is not enabled', () => {
    expect(
      shouldSkipSessionSync({
        previousRevisionHash: 'same-hash',
        nextRevisionHash: 'same-hash',
      }),
    ).toBe(true)
  })

  it('re-syncs unchanged revisions when force is enabled', () => {
    expect(
      shouldSkipSessionSync({
        previousRevisionHash: 'same-hash',
        nextRevisionHash: 'same-hash',
        force: true,
      }),
    ).toBe(false)
  })
})
