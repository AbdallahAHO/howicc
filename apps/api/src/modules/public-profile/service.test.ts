import { describe, expect, it, vi } from 'vitest'
import {
  conversations,
  conversationViews,
  users,
} from '@howicc/db/schema'
import type { SessionDigest } from '@howicc/canonical'

const mocks = vi.hoisted(() => ({
  getRuntimeDatabase: vi.fn(),
}))

vi.mock('../../lib/runtime-resources', async () => {
  const actual = await vi.importActual('../../lib/runtime-resources')
  return {
    ...actual,
    getRuntimeDatabase: mocks.getRuntimeDatabase,
  }
})

const { getPublicProfile } = await import('./service')

const createDigest = (input: {
  sessionId: string
  createdAt: string
  repositoryFullName?: string
}): SessionDigest => ({
  sessionId: input.sessionId,
  provider: 'claude_code',
  projectKey: 'proj_public',
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  durationMs: 1_800_000,
  dayOfWeek: 0,
  turnCount: 8,
  messageCount: 16,
  toolRunCount: 6,
  toolCategories: {
    read: 2,
    write: 1,
    search: 1,
    command: 1,
    agent: 0,
    mcp: 0,
    plan: 0,
    question: 0,
    task: 0,
    web: 0,
    other: 1,
  },
  errorCount: 0,
  apiErrorCount: 0,
  apiErrorTypes: {},
  rejectionCount: 0,
  interruptionCount: 0,
  compactionCount: 0,
  subagentCount: 0,
  hasPlan: false,
  hasThinking: false,
  models: [{ model: 'claude-opus-4-6', inputTokens: 1200, outputTokens: 400 }],
  estimatedCostUsd: 0.42,
  hourOfDay: 9,
  sessionType: 'building',
  filesChanged: ['src/index.ts'],
  filesRead: ['src/index.ts'],
  languages: { TypeScript: 1 },
  fileIterationDepth: 1,
  gitCommits: 0,
  gitPushes: 0,
  repository: input.repositoryFullName
    ? {
        owner: input.repositoryFullName.split('/')[0] ?? 'acme',
        name: input.repositoryFullName.split('/')[1] ?? 'repo',
        fullName: input.repositoryFullName,
        source: 'git_remote',
      }
    : undefined,
  prLinks: [],
  mcpServersConfigured: [],
  mcpServersUsed: [],
  skillsTriggered: [],
  commandsInvoked: [{ name: 'rg', invocationCount: 1 }],
})

describe('public profile service', () => {
  it('derives aggregates and recent cards from a single public-only rowset', async () => {
    let publicConversationQueryCount = 0

    const publicDigest = createDigest({
      sessionId: 'sess_public',
      createdAt: '2026-04-18T10:00:00.000Z',
      repositoryFullName: 'acme/public-repo',
    })

    const user = {
      id: 'user_1',
      username: 'abdallah',
      name: 'Abdallah',
      image: 'https://example.com/avatar.png',
      websiteUrl: null,
      bio: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      publicProfileEnabled: true,
      publicProfileSettings: {
        showActivityHeatmap: true,
        showCost: true,
        showRepositories: true,
        showSessionTypes: true,
        showToolsLanguages: true,
        showBadges: true,
      },
    }

    const db = {
      select: (selection?: Record<string, unknown>) => ({
        from: (table: unknown) => {
          if (table === users) {
            return {
              where: () => ({
                limit: async () => [user],
              }),
            }
          }

          if (
            table === conversations &&
            selection &&
            'conv' in selection &&
            'digest' in selection
          ) {
            publicConversationQueryCount += 1
            return {
              innerJoin: () => ({
                where: () => ({
                  orderBy: async () => [
                      {
                        conv: {
                          id: 'conv_public',
                          slug: 'public-session',
                          title: 'Public session',
                        },
                        digest: {
                          digestJson: JSON.stringify(publicDigest),
                        },
                      },
                    ],
                }),
              }),
            }
          }

          if (table === conversationViews) {
            return {
              where: () => ({
                groupBy: async () => [
                  { conversationId: 'conv_public', count: 7 },
                ],
              }),
            }
          }

          throw new Error(`Unexpected table read in test: ${String(table)}`)
        },
      }),
    }

    mocks.getRuntimeDatabase.mockReturnValue(db)

    const payload = await getPublicProfile({ env: 'runtime' } as never, 'abdallah')

    expect(payload).not.toBeNull()
    expect(payload?.stats.sessionCount).toBe(1)
    expect(payload?.stats.totalDurationMs).toBe(1_800_000)
    expect(payload?.publicRepos).toEqual([
      { fullName: 'acme/public-repo', sessionCount: 1 },
    ])
    expect(payload?.publicSessions).toEqual([
      expect.objectContaining({
        conversationId: 'conv_public',
        viewCount: 7,
        repository: 'acme/public-repo',
      }),
    ])
    expect(publicConversationQueryCount).toBe(1)
  })
})
