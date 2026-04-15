import { describe, expect, it } from 'vitest'
import type { CanonicalSession } from '@howicc/canonical'
import { emptyToolCategories } from '@howicc/canonical'
import { buildUserProfile } from './aggregate'
import { extractSessionDigest } from './digest'

const createCanonicalSession = (): CanonicalSession => ({
  kind: 'canonical_session',
  schemaVersion: 1,
  parserVersion: 'test',
  provider: 'claude_code',
  source: {
    sessionId: 'session-1',
    projectKey: 'project-key',
    projectPath: '/workspace/project',
    sourceRevisionHash: 'revision-hash',
    transcriptSha256: 'sha',
    importedAt: '2026-04-01T10:05:00.000Z',
  },
  metadata: {
    title: 'Test session',
    cwd: '/workspace/project',
    gitBranch: 'main',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:04:00.000Z',
  },
  selection: {
    strategy: 'latest_leaf',
    selectedLeafUuid: 'a1',
    branchCount: 1,
  },
  stats: {
    visibleMessageCount: 3,
    toolRunCount: 1,
    artifactCount: 0,
    subagentCount: 0,
  },
  events: [
    {
      type: 'user_message',
      id: 'u1',
      timestamp: '2026-04-01T10:00:00.000Z',
      text: '/chrome-devtools',
      commandInvocation: {
        kind: 'slash_command',
        name: 'chrome-devtools',
        slashName: '/chrome-devtools',
      },
    },
    {
      type: 'assistant_message',
      id: 'a1',
      timestamp: '2026-04-01T10:00:01.000Z',
      text: 'Opening the browser.',
    },
    {
      type: 'tool_call',
      id: 'tc1',
      toolUseId: 'tool-1',
      timestamp: '2026-04-01T10:00:02.000Z',
      toolName: 'Skill',
      displayName: 'Skill',
      source: 'native',
      input: {
        skill: 'chrome-devtools',
      },
    },
  ],
  agents: [],
  assets: [],
  artifacts: [],
  searchText: '/chrome-devtools\nOpening the browser.',
  providerData: {
    claudeCode: {
      metrics: {
        turnCount: 1,
        durationMs: 60_000,
        usageTimeline: [],
      },
      digestHints: {
        mcpServersConfigured: [],
        prLinks: [],
        apiErrors: [],
      },
    },
  },
})

describe('extractSessionDigest', () => {
  it('captures normalized slash commands alongside skill usage', () => {
    const digest = extractSessionDigest(createCanonicalSession())

    expect(digest.skillsTriggered).toEqual([
      {
        name: 'chrome-devtools',
        invocationCount: 1,
      },
    ])
    expect(digest.commandsInvoked).toEqual([
      {
        name: 'chrome-devtools',
        invocationCount: 1,
      },
    ])
    expect(digest.toolCategories).toEqual({
      ...emptyToolCategories(),
      other: 1,
    })
  })

  it('bubbles command usage into the aggregated profile toolcraft view', () => {
    const digest = extractSessionDigest(createCanonicalSession())
    const profile = buildUserProfile('user-1', [digest, { ...digest, sessionId: 'session-2' }])

    expect(profile.toolcraft.topCommands).toEqual([
      {
        name: 'chrome-devtools',
        sessionCount: 2,
        totalInvocations: 2,
      },
    ])
  })
})
