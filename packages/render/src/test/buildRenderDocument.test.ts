import { describe, expect, it } from 'vitest'
import type { CanonicalSession } from '@howicc/canonical'
import type { ActivityGroupBlock } from '../block'
import { buildRenderDocument } from '../buildRenderDocument'

const baseSession: CanonicalSession = {
  kind: 'canonical_session',
  schemaVersion: 1,
  parserVersion: 'test',
  provider: 'claude_code',
  source: {
    sessionId: 'session_1',
    projectKey: 'project-key',
    projectPath: '/workspace/project',
    sourceRevisionHash: 'hash_1',
    transcriptSha256: 'transcript_sha',
    importedAt: '2026-04-01T10:00:00.000Z',
  },
  metadata: {
    title: 'Fix SSH access',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:05:00.000Z',
    gitBranch: 'main',
  },
  selection: {
    strategy: 'latest_leaf',
    branchCount: 1,
  },
  stats: {
    visibleMessageCount: 3,
    toolRunCount: 2,
    artifactCount: 5,
    subagentCount: 1,
  },
  events: [
    {
      type: 'user_message',
      id: 'u1',
      timestamp: '2026-04-01T10:00:00.000Z',
      text: 'Can you fix SSH access?',
    },
    {
      type: 'assistant_message',
      id: 'a1',
      timestamp: '2026-04-01T10:00:05.000Z',
      text: 'I will inspect the SSH setup.',
      isMeta: false,
    },
    {
      type: 'tool_call',
      id: 'call_1',
      toolUseId: 'tool_1',
      timestamp: '2026-04-01T10:00:06.000Z',
      toolName: 'Bash',
      displayName: 'Bash',
      source: 'native',
      input: { command: 'ssh-add -L' },
      commentLabel: 'ssh-add -L',
    },
    {
      type: 'tool_result',
      id: 'result_1',
      toolUseId: 'tool_1',
      timestamp: '2026-04-01T10:00:07.000Z',
      status: 'ok',
      text: 'The agent has no identities.',
      artifactId: 'asset_tool_1',
    },
    {
      type: 'tool_call',
      id: 'call_2',
      toolUseId: 'tool_2',
      timestamp: '2026-04-01T10:00:08.000Z',
      toolName: 'Read',
      displayName: 'Read',
      source: 'native',
      input: { file_path: '/Users/abdallah/.ssh/config' },
      commentLabel: '/Users/abdallah/.ssh/config',
    },
    {
      type: 'tool_result',
      id: 'result_2',
      toolUseId: 'tool_2',
      timestamp: '2026-04-01T10:00:09.000Z',
      status: 'error',
      text: 'Permission denied',
    },
    {
      type: 'hook',
      id: 'hook_1',
      timestamp: '2026-04-01T10:00:10.000Z',
      hookEvent: 'stop',
      toolUseId: 'tool_2',
      label: 'stop_hook_summary',
      text: 'post-check (18ms)',
      preventedContinuation: true,
    },
    {
      type: 'assistant_message',
      id: 'a2',
      timestamp: '2026-04-01T10:00:11.000Z',
      text: 'The SSH agent is not serving any keys yet.',
      isMeta: false,
    },
  ],
  agents: [
    {
      agentId: 'agent_1',
      title: 'Inspect subagent',
      role: 'subagent',
      events: [
        {
          type: 'assistant_message',
          id: 'agent_a1',
          timestamp: '2026-04-01T10:00:12.000Z',
          text: 'Subagent report',
          isMeta: false,
        },
      ],
    },
  ],
  assets: [],
  artifacts: [
    {
      id: 'plan:main',
      artifactType: 'plan',
      provider: 'claude_code',
      source: {},
      role: 'main',
      resolutionSource: 'tool_use',
      content: '1. Check SSH agent\n2. Verify server access',
    },
    {
      id: 'question:tool_1',
      artifactType: 'question_interaction',
      provider: 'claude_code',
      source: {
        toolUseIds: ['tool_1'],
      },
      outcome: 'answered',
      questions: [
        {
          header: 'Server',
          question: 'Which server should I inspect?',
          options: [],
          multiSelect: false,
        },
      ],
      answers: {
        Server: 'Hetzner',
      },
    },
    {
      id: 'tool-decision:tool_2',
      artifactType: 'tool_decision',
      provider: 'claude_code',
      source: {
        toolUseIds: ['tool_2'],
        eventIds: ['call_2', 'result_2'],
      },
      toolName: 'Read',
      status: 'rejected',
      feedbackText: 'Permission denied',
      isErrorResult: true,
    },
    {
      id: 'todo:tool_2',
      artifactType: 'todo_snapshot',
      provider: 'claude_code',
      source: {
        toolUseIds: ['tool_2'],
      },
      todos: [
        {
          content: 'Unlock 1Password',
          status: 'in_progress',
          priority: 'high',
        },
      ],
    },
    {
      id: 'tool-output:tool_1',
      artifactType: 'tool_output',
      provider: 'claude_code',
      source: {
        toolUseIds: ['tool_1'],
      },
      toolName: 'Bash',
      status: 'ok',
      previewText: 'The agent has no identities.',
      fullOutputAssetId: 'asset_tool_1',
    },
  ],
  searchText: 'Fix SSH access',
}

describe('buildRenderDocument', () => {
  it('emits grouped activity blocks and anchored artifacts', () => {
    const render = buildRenderDocument(baseSession)

    expect(render.session.title).toBe('Fix SSH access')
    expect(render.session.stats.activityGroupCount).toBe(1)
    expect(render.context?.currentPlan?.artifactId).toBe('plan:main')

    expect(render.blocks.map(block => block.type)).toEqual([
      'message',
      'message',
      'activity_group',
      'question',
      'callout',
      'todo_snapshot',
      'message',
      'subagent_thread',
    ])

    const activityGroup = render.blocks[2] as ActivityGroupBlock
    expect(activityGroup?.type).toBe('activity_group')
    expect(activityGroup?.items).toHaveLength(3)
    expect(activityGroup?.items[0]).toMatchObject({
      type: 'tool_run',
      toolName: 'Bash',
      status: 'ok',
      artifactId: 'asset_tool_1',
    })
    expect(activityGroup?.items[1]).toMatchObject({
      type: 'tool_run',
      toolName: 'Read',
      status: 'error',
    })
    expect(activityGroup?.items[2]).toMatchObject({
      type: 'hook_event',
      tone: 'error',
    })
  })
})
