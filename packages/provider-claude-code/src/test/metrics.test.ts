import { normalizeOpenRouterCatalog } from '@howicc/model-pricing'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildClaudeCanonicalSession } from '../canonical'
import { buildClaudeSourceBundle } from '../bundle'
import type { DiscoveredSession } from '@howicc/parser-core'

const tempDirectories: string[] = []

const pricingCatalog = normalizeOpenRouterCatalog(
  {
    data: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        canonical_slug: 'anthropic/claude-4.6-sonnet-20260217',
        name: 'Anthropic: Claude Sonnet 4.6',
        pricing: {
          prompt: '0.000003',
          completion: '0.000015',
          input_cache_read: '0.0000003',
          input_cache_write: '0.00000375',
        },
      },
      {
        id: 'anthropic/claude-haiku-4.5',
        canonical_slug: 'anthropic/claude-4.5-haiku-20251001',
        name: 'Anthropic: Claude Haiku 4.5',
        pricing: {
          prompt: '0.0000008',
          completion: '0.000004',
          input_cache_read: '0.00000008',
          input_cache_write: '0.000001',
        },
      },
    ],
  },
  { fetchedAt: '2026-04-09T00:00:00.000Z' },
)

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('conversation metrics and timelines', () => {
  it('captures model and permission mode changes with token totals', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-metrics')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-metrics'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)

    await mkdir(projectDirectory, { recursive: true })

    const lines = [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        promptId: 'p1',
        timestamp: '2026-04-01T10:00:00.000Z',
        permissionMode: 'acceptEdits',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: { role: 'user', content: 'hello' },
      },
      {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u1',
        timestamp: '2026-04-01T10:00:01.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            cache_creation_input_tokens: 5,
            cache_read_input_tokens: 2,
          },
          content: [{ type: 'text', text: 'first answer' }],
        },
      },
      {
        type: 'user',
        uuid: 'u2',
        parentUuid: 'a1',
        promptId: 'p2',
        timestamp: '2026-04-01T10:00:05.000Z',
        permissionMode: 'bypassPermissions',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: { role: 'user', content: 'second question' },
      },
      {
        type: 'user',
        uuid: 'u2-plan',
        parentUuid: 'u2',
        promptId: 'p2',
        timestamp: '2026-04-01T10:00:06.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'enter-plan',
              content: 'Entered plan mode.',
            },
          ],
        },
        toolUseResult: {
          message:
            'Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.',
        },
      },
      {
        type: 'assistant',
        uuid: 'a2',
        parentUuid: 'u2-plan',
        timestamp: '2026-04-01T10:00:08.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          usage: {
            input_tokens: 12,
            output_tokens: 4,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 1,
          },
          content: [
            {
              type: 'tool_use',
              id: 'exit-plan',
              name: 'ExitPlanMode',
              input: { plan: '# Plan\n\nDo thing' },
            },
            { type: 'text', text: 'second answer' },
          ],
        },
      },
    ]

    await writeFile(
      transcriptPath,
      lines.map(line => JSON.stringify(line)).join('\n'),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:08.000Z',
      sizeBytes: 100,
      slug: 'metrics-river',
      gitBranch: 'main',
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const canonical = await buildClaudeCanonicalSession({
      bundle,
      session,
      parserVersion: 'test',
      pricingCatalog,
    })

    const metrics = (canonical.providerData?.claudeCode as {
      metrics: {
        modelsUsed: string[]
        modelTimeline: Array<{ model: string }>
        modelSelectionTimeline: Array<{ modelLabel: string; source: string }>
        usageTimeline: Array<{ model: string }>
        permissionModeTimeline: Array<{ mode: string }>
        sessionModeTimeline: Array<{ mode: string; event: string }>
        inputTokens: number
        outputTokens: number
        cacheCreationInputTokens: number
        cacheReadInputTokens: number
        durationMs: number
        estimatedCostUsd?: number
        costReliability: string
      }
    }).metrics

    expect(metrics.modelsUsed).toEqual(
      expect.arrayContaining(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']),
    )
    expect(metrics.modelTimeline.map(entry => entry.model)).toEqual([
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ])
    expect(metrics.modelSelectionTimeline).toEqual([])
    expect(metrics.usageTimeline.map(entry => entry.model)).toEqual([
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ])
    expect(metrics.permissionModeTimeline.map(entry => entry.mode)).toEqual([
      'acceptEdits',
      'bypassPermissions',
    ])
    expect(metrics.sessionModeTimeline).toEqual([
      { mode: 'plan', event: 'enter', source: 'tool_event', timestamp: '2026-04-01T10:00:06.000Z' },
      { mode: 'plan', event: 'exit', source: 'tool_event', timestamp: '2026-04-01T10:00:08.000Z' },
    ])
    expect(metrics.inputTokens).toBe(22)
    expect(metrics.outputTokens).toBe(24)
    expect(metrics.cacheCreationInputTokens).toBe(5)
    expect(metrics.cacheReadInputTokens).toBe(3)
    expect(metrics.durationMs).toBe(8000)
    expect(metrics.costReliability).toBe('alias_match')
    expect(metrics.estimatedCostUsd).toBeCloseTo(0.00037503, 8)
  })

  it('tracks model changes from /model local-command output separately from API model usage', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-model-switch')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-model-switch'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)

    await mkdir(projectDirectory, { recursive: true })

    const lines = [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        promptId: 'p1',
        timestamp: '2026-04-01T10:00:00.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'user',
          content:
            '<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args></command-args>',
        },
      },
      {
        type: 'user',
        uuid: 'u2',
        parentUuid: 'u1',
        promptId: 'p1',
        timestamp: '2026-04-01T10:00:01.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'user',
          content:
            '<local-command-stdout>Set model to \u001b[1mOpus 4.6 (1M context) (default)\u001b[22m</local-command-stdout>',
        },
      },
      {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u2',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        gitBranch: 'main',
        slug: 'metrics-river',
        message: {
          role: 'assistant',
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          content: [{ type: 'text', text: 'switched' }],
        },
      },
    ]

    await writeFile(
      transcriptPath,
      lines.map(line => JSON.stringify(line)).join('\n'),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:02.000Z',
      sizeBytes: 100,
      slug: 'metrics-river',
      gitBranch: 'main',
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const canonical = await buildClaudeCanonicalSession({
      bundle,
      session,
      parserVersion: 'test',
    })

    const metrics = (canonical.providerData?.claudeCode as {
      metrics: {
        modelTimeline: Array<{ model: string }>
        modelSelectionTimeline: Array<{ modelLabel: string; source: string; timestamp?: string }>
      }
    }).metrics

    expect(metrics.modelTimeline).toEqual([
      { model: 'claude-opus-4-6', timestamp: '2026-04-01T10:00:02.000Z' },
    ])
    expect(metrics.modelSelectionTimeline).toEqual([
      {
        modelLabel: 'Opus 4.6 (1M context) (default)',
        source: 'local_command_output',
        timestamp: '2026-04-01T10:00:01.000Z',
      },
    ])
  })

  it('deduplicates token usage across multi-block API responses', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-dedup')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-dedup'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)

    await mkdir(projectDirectory, { recursive: true })

    // Simulate CC's real behavior: one API response split into 4 JSONL entries
    // (thinking → text → tool_use → tool_use), all carrying the same usage snapshot
    const lines = [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        promptId: 'p1',
        timestamp: '2026-04-01T10:00:00.000Z',
        cwd: projectPath,
        message: { role: 'user', content: 'hello' },
      },
      // Entry 1: thinking block — same usage as text/tool entries
      {
        type: 'assistant',
        uuid: 'a1-think',
        parentUuid: 'u1',
        timestamp: '2026-04-01T10:00:01.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 100, output_tokens: 5, cache_creation_input_tokens: 500, cache_read_input_tokens: 2000 },
          content: [{ type: 'thinking', thinking: '', signature: 'abc' }],
        },
      },
      // Entry 2: text block — same usage snapshot
      {
        type: 'assistant',
        uuid: 'a1-text',
        parentUuid: 'a1-think',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 500, cache_read_input_tokens: 2000 },
          content: [{ type: 'text', text: 'Let me help with that.' }],
        },
      },
      // Entry 3: first tool_use — same usage snapshot
      {
        type: 'assistant',
        uuid: 'a1-tool1',
        parentUuid: 'a1-text',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 500, cache_read_input_tokens: 2000 },
          content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/src/index.ts' } }],
        },
      },
      // Entry 4: second tool_use — output_tokens grew slightly
      {
        type: 'assistant',
        uuid: 'a1-tool2',
        parentUuid: 'a1-tool1',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 100, output_tokens: 80, cache_creation_input_tokens: 500, cache_read_input_tokens: 2000 },
          content: [{ type: 'tool_use', id: 'tu2', name: 'Glob', input: { pattern: '**/*.ts' } }],
        },
      },
      // Tool results come back
      {
        type: 'user',
        uuid: 'u-tr1',
        parentUuid: 'a1-tool2',
        timestamp: '2026-04-01T10:00:03.000Z',
        cwd: projectPath,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'file contents' }],
        },
      },
      {
        type: 'user',
        uuid: 'u-tr2',
        parentUuid: 'a1-tool1',
        timestamp: '2026-04-01T10:00:03.000Z',
        cwd: projectPath,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu2', content: 'glob results' }],
        },
      },
      // Second API response — different usage values
      {
        type: 'assistant',
        uuid: 'a2',
        parentUuid: 'u-tr2',
        timestamp: '2026-04-01T10:00:04.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 200, output_tokens: 30, cache_creation_input_tokens: 100, cache_read_input_tokens: 3000 },
          content: [{ type: 'text', text: 'Done!' }],
        },
      },
    ]

    await writeFile(
      transcriptPath,
      lines.map(line => JSON.stringify(line)).join('\n'),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:04.000Z',
      sizeBytes: 100,
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const canonical = await buildClaudeCanonicalSession({
      bundle,
      session,
      parserVersion: 'test',
    })

    const metrics = (canonical.providerData?.claudeCode as {
      metrics: {
        inputTokens: number
        outputTokens: number
        cacheCreationInputTokens: number
        cacheReadInputTokens: number
        usageTimeline: Array<{ inputTokens: number; outputTokens: number }>
      }
    }).metrics

    // Without dedup: 4 entries × 100 + 200 = 600 input tokens
    // With dedup: 100 (group 1) + 200 (group 2) = 300 input tokens
    expect(metrics.inputTokens).toBe(300)

    // Output tokens: max(5, 50, 50, 80) = 80 for group 1, 30 for group 2 = 110
    expect(metrics.outputTokens).toBe(110)

    // Cache write: 500 (group 1) + 100 (group 2) = 600
    expect(metrics.cacheCreationInputTokens).toBe(600)

    // Cache read: 2000 (group 1) + 3000 (group 2) = 5000
    expect(metrics.cacheReadInputTokens).toBe(5000)

    // Should produce exactly 2 timeline entries (one per API response)
    expect(metrics.usageTimeline).toHaveLength(2)
    expect(metrics.usageTimeline[0]!.inputTokens).toBe(100)
    expect(metrics.usageTimeline[0]!.outputTokens).toBe(80)
    expect(metrics.usageTimeline[1]!.inputTokens).toBe(200)
    expect(metrics.usageTimeline[1]!.outputTokens).toBe(30)
  })

  it('filters thinking-only entries and derives tool labels', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-thinking')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-thinking'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)

    await mkdir(projectDirectory, { recursive: true })

    const lines = [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:00.000Z',
        cwd: projectPath,
        message: { role: 'user', content: 'read my file' },
      },
      // Thinking-only entry — should be filtered from events
      {
        type: 'assistant',
        uuid: 'a1-think',
        parentUuid: 'u1',
        timestamp: '2026-04-01T10:00:01.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [{ type: 'thinking', thinking: '', signature: 'sig123' }],
        },
      },
      // Text entry — should produce assistant_message
      {
        type: 'assistant',
        uuid: 'a1-text',
        parentUuid: 'a1-think',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 10, output_tokens: 20 },
          content: [{ type: 'text', text: 'I will read that file.' }],
        },
      },
      // Tool use — should produce tool_call with derived label
      {
        type: 'assistant',
        uuid: 'a1-read',
        parentUuid: 'a1-text',
        timestamp: '2026-04-01T10:00:02.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 10, output_tokens: 30 },
          content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/src/app.ts' } }],
        },
      },
      // User message with images
      {
        type: 'user',
        uuid: 'u2',
        parentUuid: 'a1-read',
        timestamp: '2026-04-01T10:00:05.000Z',
        cwd: projectPath,
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'check these screenshots' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'def' } },
          ],
        },
      },
    ]

    await writeFile(
      transcriptPath,
      lines.map(line => JSON.stringify(line)).join('\n'),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:05.000Z',
      sizeBytes: 100,
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const canonical = await buildClaudeCanonicalSession({
      bundle,
      session,
      parserVersion: 'test',
    })

    // Redacted thinking entries (empty text + signature) should not produce events.
    // But we only have one thinking block in this test and it has empty text,
    // so it should be filtered. The text entry should produce one message.
    const assistantMessages = canonical.events.filter(e => e.type === 'assistant_message')
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]!.type === 'assistant_message' && assistantMessages[0]!.text).toBe('I will read that file.')

    // No event text should contain raw thinking JSON
    for (const event of canonical.events) {
      if ('text' in event && typeof event.text === 'string') {
        expect(event.text).not.toMatch(/^\{"type":"thinking"/)
      }
    }

    // Tool call should have derived label from file_path
    const toolCalls = canonical.events.filter(e => e.type === 'tool_call')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.type === 'tool_call' && toolCalls[0]!.commentLabel).toBe('/src/app.ts')

    // User message with images should include placeholder
    const userMessages = canonical.events.filter(e => e.type === 'user_message')
    const imageMsg = userMessages.find(
      e => e.type === 'user_message' && e.text.includes('images attached'),
    )
    expect(imageMsg).toBeTruthy()
    expect(imageMsg!.type === 'user_message' && imageMsg!.text).toContain('check these screenshots')
    expect(imageMsg!.type === 'user_message' && imageMsg!.text).toContain('2 images attached')
  })

  it('emits content-bearing thinking blocks as isMeta assistant messages', async () => {
    const claudeHomeDir = await mkdtemp(path.join(tmpdir(), 'howicc-claude-'))
    tempDirectories.push(claudeHomeDir)

    const projectPath = path.join(tmpdir(), 'howicc-project-thinking-content')
    const projectDirectory = path.join(claudeHomeDir, 'projects', 'project-key')
    const sessionId = 'session-thinking-content'
    const transcriptPath = path.join(projectDirectory, `${sessionId}.jsonl`)

    await mkdir(projectDirectory, { recursive: true })

    const lines = [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        timestamp: '2026-04-01T10:00:00.000Z',
        cwd: projectPath,
        message: { role: 'user', content: 'explain this code' },
      },
      // Thinking block WITH actual content (extended thinking enabled)
      {
        type: 'assistant',
        uuid: 'a1-think',
        parentUuid: 'u1',
        timestamp: '2026-04-01T10:00:01.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-opus-4-6',
          usage: { input_tokens: 100, output_tokens: 50 },
          content: [{
            type: 'thinking',
            thinking: 'The user wants me to explain this code. Let me analyze the function structure and identify the key patterns.',
            signature: 'sig-abc',
          }],
        },
      },
      // Text response
      {
        type: 'assistant',
        uuid: 'a1-text',
        parentUuid: 'a1-think',
        timestamp: '2026-04-01T10:00:03.000Z',
        cwd: projectPath,
        message: {
          role: 'assistant',
          model: 'claude-opus-4-6',
          usage: { input_tokens: 100, output_tokens: 200 },
          content: [{ type: 'text', text: 'This function implements a binary search.' }],
        },
      },
    ]

    await writeFile(
      transcriptPath,
      lines.map(line => JSON.stringify(line)).join('\n'),
    )

    const session: DiscoveredSession = {
      provider: 'claude_code',
      sessionId,
      projectKey: 'project-key',
      projectPath,
      transcriptPath,
      updatedAt: '2026-04-01T10:00:03.000Z',
      sizeBytes: 100,
    }

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })
    const canonical = await buildClaudeCanonicalSession({
      bundle,
      session,
      parserVersion: 'test',
    })

    const assistantMessages = canonical.events.filter(e => e.type === 'assistant_message')

    // Should produce 2 messages: thinking (isMeta=true) + text (isMeta=false)
    expect(assistantMessages).toHaveLength(2)

    const thinkingMsg = assistantMessages.find(
      e => e.type === 'assistant_message' && e.isMeta === true,
    )
    expect(thinkingMsg).toBeTruthy()
    expect(thinkingMsg!.type === 'assistant_message' && thinkingMsg!.text).toContain(
      'Let me analyze the function structure',
    )

    const textMsg = assistantMessages.find(
      e => e.type === 'assistant_message' && !e.isMeta,
    )
    expect(textMsg).toBeTruthy()
    expect(textMsg!.type === 'assistant_message' && textMsg!.text).toBe(
      'This function implements a binary search.',
    )
  })
})
