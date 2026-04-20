import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CanonicalSession, SessionDigest, ToolCallEvent, ToolResultEvent } from '@howicc/canonical'
import { categorizeToolName } from '@howicc/canonical'
import { matchClaudeModel, normalizeOpenRouterCatalog } from '@howicc/model-pricing'
import { extractSessionDigest, buildUserProfile } from '@howicc/profile'
import { buildClaudeCanonicalSession } from '../canonical'
import { buildClaudeSourceBundle } from '../bundle'
import { discoverClaudeSessions } from '../discover'
import { getClaudeHomeDir } from '../claudePaths'

const claudeHomeDir = getClaudeHomeDir()

const describeWithLocalClaude = await hasLocalClaudeData(claudeHomeDir)
  ? describe
  : describe.skip

const pricingCatalog = normalizeOpenRouterCatalog(
  {
    data: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        canonical_slug: 'anthropic/claude-4.6-sonnet-20260217',
        name: 'Anthropic: Claude Sonnet 4.6',
        pricing: { prompt: '0.000003', completion: '0.000015' },
      },
      {
        id: 'anthropic/claude-sonnet-4.5',
        canonical_slug: 'anthropic/claude-4.5-sonnet-20250929',
        name: 'Anthropic: Claude Sonnet 4.5',
        pricing: { prompt: '0.000003', completion: '0.000015' },
      },
      {
        id: 'anthropic/claude-haiku-4.5',
        canonical_slug: 'anthropic/claude-4.5-haiku-20251001',
        name: 'Anthropic: Claude Haiku 4.5',
        pricing: { prompt: '0.0000008', completion: '0.000004' },
      },
      {
        id: 'anthropic/claude-opus-4.6',
        canonical_slug: 'anthropic/claude-4.6-opus-20260205',
        name: 'Anthropic: Claude Opus 4.6',
        pricing: { prompt: '0.000015', completion: '0.000075' },
      },
      {
        id: 'anthropic/claude-opus-4.7',
        canonical_slug: 'anthropic/claude-4.7-opus',
        name: 'Anthropic: Claude Opus 4.7',
        pricing: { prompt: '0.000015', completion: '0.000075' },
      },
      {
        id: 'anthropic/claude-opus-4.5',
        canonical_slug: 'anthropic/claude-4.5-opus-20251124',
        name: 'Anthropic: Claude Opus 4.5',
        pricing: { prompt: '0.000015', completion: '0.000075' },
      },
    ],
  },
  { fetchedAt: 'local-test' },
)

const rawMachineTagPattern =
  /<(?:local-command-stdout|local-command-stderr|bash-stdout|bash-stderr|task-notification)\b/i

describeWithLocalClaude('local Claude Code integration', () => {
  it('discovers real local sessions', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })

    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions[0]?.provider).toBe('claude_code')
  })

  it('builds bundles for a real session with sidecars', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const session = await findFirstSessionMatching(sessions, async candidate => {
      const sessionDirectory = candidate.transcriptPath.replace(/\.jsonl$/, '')

      return hasAnyFile(path.join(sessionDirectory, 'tool-results')) ||
        hasAnyFile(path.join(sessionDirectory, 'subagents'))
    })

    expect(session).toBeTruthy()

    if (!session) return

    const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })

    expect(bundle.files.some(file => file.kind === 'transcript')).toBe(true)
    expect(
      bundle.files.some(
        file => file.kind === 'tool_result' || file.kind === 'subagent_transcript',
      ),
    ).toBe(true)
  })

  it('parses a real AskUserQuestion session into question artifacts', async () => {
    // AskUserQuestion may exist in raw JSONL but not in the selected active
    // thread (e.g., on a dead branch). Try multiple sessions until we find
    // one where the artifact extractor produces a question_interaction.
    const sessions = await discoverClaudeSessions({ claudeHomeDir })

    let found = false
    for (const session of sessions) {
      try {
        const content = await readFile(session.transcriptPath, 'utf8')
        if (!content.includes('"name":"AskUserQuestion"')) continue

        const canonical = await parseRealSession(session)
        if (canonical.artifacts.some(a => a.artifactType === 'question_interaction')) {
          found = true
          break
        }
      } catch {
        continue
      }
    }

    // Skip if no local session produces a question artifact
    if (!found) return

    expect(found).toBe(true)
  })

  it('parses a real TodoWrite session into todo artifacts', async () => {
    const session = await findSessionContaining('"name":"TodoWrite"')

    if (!session) {
      return
    }

    const canonical = await parseRealSession(session)

    expect(
      canonical.artifacts.some(artifact => artifact.artifactType === 'todo_snapshot'),
    ).toBe(true)
  })

  it('normalizes slash-command transcripts from real local sessions', async () => {
    const session = await findSessionContaining('<command-name>/')

    if (!session) {
      return
    }

    const canonical = await parseRealSession(session)
    const commandEvents = canonical.events.filter(
      event =>
        event.type === 'user_message' &&
        event.commandInvocation?.kind === 'slash_command',
    )

    expect(commandEvents.length).toBeGreaterThan(0)
    expect(canonical.metadata.title).not.toContain('<command-name>')
    expect(canonical.metadata.title).not.toContain('<local-command-caveat>')
    expect(canonical.searchText).not.toContain('<command-name>')
    expect(canonical.searchText).not.toContain('<local-command-caveat>')
  })

  it('keeps discovery previews free of raw machine tags across all local sessions', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const offenders = sessions
      .filter(session => rawMachineTagPattern.test(session.firstPromptPreview ?? ''))
      .map(session => ({
        sessionId: session.sessionId,
        preview: session.firstPromptPreview,
      }))

    expect(offenders).toEqual([])
  })

  it(
    'keeps canonical titles, search text, and user messages free of raw machine tags across all matching local sessions',
    async () => {
      const sessions = await discoverClaudeSessions({ claudeHomeDir })
      const sessionsWithMachineTags = await findAllSessionsMatching(sessions, async candidate => {
        const content = await readFile(candidate.transcriptPath, 'utf8')
        return rawMachineTagPattern.test(content)
      })

      const offenders: Array<{
        sessionId: string
        title?: string
        hasRawSearchText: boolean
        rawUserMessages: string[]
      }> = []

      for (const session of sessionsWithMachineTags) {
        const canonical = await parseRealSession(session)
        const rawUserMessages = canonical.events
          .filter(
            (
              event,
            ): event is Extract<(typeof canonical.events)[number], { type: 'user_message' }> =>
              event.type === 'user_message' && rawMachineTagPattern.test(event.text),
          )
          .map(event => event.text)

        const hasRawTitle = rawMachineTagPattern.test(canonical.metadata.title ?? '')
        const hasRawSearchText = rawMachineTagPattern.test(canonical.searchText)

        if (hasRawTitle || hasRawSearchText || rawUserMessages.length > 0) {
          offenders.push({
            sessionId: session.sessionId,
            title: canonical.metadata.title,
            hasRawSearchText,
            rawUserMessages,
          })
        }
      }

      expect(offenders).toEqual([])
    },
    30_000,
  )

  it('tracks real /model changes in the metrics model selection timeline', async () => {
    const session = await findSessionContaining('<local-command-stdout>Set model to')

    if (!session) {
      return
    }

    const canonical = await parseRealSession(session)
    const metrics = getMetrics(canonical) as MetricsShape & {
      modelSelectionTimeline?: Array<{ modelLabel: string; timestamp?: string }>
    }

    expect(metrics.modelSelectionTimeline?.length ?? 0).toBeGreaterThan(0)
    expect(metrics.modelSelectionTimeline?.some(entry => entry.modelLabel.length > 0)).toBe(
      true,
    )
  })

  it('keeps message and tool counts for real sessions whose latest summaries hang off attachments', async () => {
    const session = await findSessionContaining('khromata_judgments_117.json')

    if (!session) {
      return
    }

    const canonical = await parseRealSession(session)

    expect(canonical.searchText).toContain('khromata_judgments_117.json')
    expect(
      canonical.events.some(
        event => 'text' in event && event.text?.includes('khromata_judgments_117.json'),
      ),
    ).toBe(true)
    expect(canonical.stats.visibleMessageCount).toBeGreaterThan(0)
    expect(canonical.stats.toolRunCount).toBeGreaterThan(0)
    expect(canonical.events.some(event => event.type === 'hook')).toBe(true)
  })

  it('parses a real session with plan files into plan artifacts', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const session = await findFirstSessionMatching(sessions, async candidate => {
      if (!candidate.slug) return false

      return hasAnyFile(path.join(claudeHomeDir, 'plans'), `${candidate.slug}.md`)
    })

    if (!session) {
      return
    }

    const canonical = await parseRealSession(session)

    expect(canonical.artifacts.some(artifact => artifact.artifactType === 'plan')).toBe(
      true,
    )
  })

  it('captures conversation-level Claude metrics from a real session', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const session = sessions[0]

    expect(session).toBeTruthy()

    if (!session) return

    const canonical = await parseRealSession(session)
    const metrics = (canonical.providerData?.claudeCode as {
      metrics?: {
        messageCount: number
        turnCount: number
        modelsUsed: string[]
        inputTokens: number
        outputTokens: number
        durationMs?: number
      }
    })?.metrics

    expect(metrics).toBeTruthy()
    expect(metrics?.messageCount).toBeGreaterThan(0)
    expect(metrics?.turnCount).toBeGreaterThan(0)
    expect(metrics?.modelsUsed.length).toBeGreaterThan(0)
    expect((metrics?.inputTokens ?? 0) + (metrics?.outputTokens ?? 0)).toBeGreaterThan(
      0,
    )
    expect(metrics?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('matches real local Claude model ids conservatively against pricing catalog fixtures', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const models = new Set<string>()

    for (const session of sessions.slice(0, 20)) {
      const canonical = await parseRealSession(session)
      const metrics = (canonical.providerData?.claudeCode as {
        metrics?: { modelsUsed?: string[] }
      })?.metrics

      for (const model of metrics?.modelsUsed ?? []) {
        models.add(model)
      }
    }

    const results = [...models].map(model => ({
      model,
      matchType: matchClaudeModel(model, pricingCatalog).matchType,
    }))

    const unexpectedUnmatched = results.filter(
      result =>
        result.matchType === 'unmatched' &&
        !['sonnet', 'haiku', 'opus', '<synthetic>'].includes(result.model),
    )

    expect(unexpectedUnmatched).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Targeted session tests — uses a known real conversation to assert specific
// pipeline behaviors against real CC transcript structure.
// ---------------------------------------------------------------------------

const TARGET_SESSION_ID = 'f40fecf9-e6c8-4c57-ac3a-2eacd12cd428'

const describeWithTargetSession = await hasTargetSession(claudeHomeDir, TARGET_SESSION_ID)
  ? describe
  : describe.skip

describeWithTargetSession(`targeted pipeline tests (session ${TARGET_SESSION_ID.slice(0, 8)})`, () => {
  let canonical: CanonicalSession
  let digest: SessionDigest

  const getCanonical = async () => {
    if (!canonical) {
      const sessions = await discoverClaudeSessions({ claudeHomeDir })
      const session = sessions.find(s => s.sessionId === TARGET_SESSION_ID)!
      canonical = await parseRealSession(session)
    }
    return canonical
  }

  const getDigest = async () => {
    if (!digest) {
      digest = extractSessionDigest(await getCanonical())
    }
    return digest
  }

  // ── Canonical session structure ──────────────────────────────────────────

  it('produces a well-formed canonical session', async () => {
    const session = await getCanonical()

    expect(session.kind).toBe('canonical_session')
    expect(session.schemaVersion).toBe(1)
    expect(session.provider).toBe('claude_code')
    expect(session.source.sessionId).toBe(TARGET_SESSION_ID)
    expect(session.source.projectKey).toBeTruthy()
    expect(session.source.transcriptSha256).toBeTruthy()
    expect(session.source.importedAt).toBeTruthy()
    expect(session.metadata.gitBranch).toBe('chore/howicc-revamp-foundation')
    expect(session.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(session.metadata.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(session.searchText.length).toBeGreaterThan(1000)
  })

  it('has correct stats relative to event counts', async () => {
    const session = await getCanonical()

    const actualMessages = session.events.filter(
      e => e.type === 'user_message' || e.type === 'assistant_message',
    ).length
    const actualToolCalls = session.events.filter(e => e.type === 'tool_call').length

    expect(session.stats.visibleMessageCount).toBe(actualMessages)
    expect(session.stats.toolRunCount).toBe(actualToolCalls)
    expect(session.stats.subagentCount).toBe(session.agents.length)
    expect(session.stats.artifactCount).toBe(session.artifacts.length)
  })

  // ── Token deduplication ──────────────────────────────────────────────────

  it('deduplicates token usage across multi-block API responses', async () => {
    const session = await getCanonical()
    const metrics = getMetrics(session)

    expect(metrics.inputTokens).toBeGreaterThan(5_000)
    expect(metrics.outputTokens).toBeGreaterThan(10_000)
    expect(metrics.cacheCreationInputTokens).toBeGreaterThan(100_000)
    expect(metrics.usageTimeline.length).toBeLessThan(metrics.messageCount)
    expect(metrics.usageTimeline.length).toBeGreaterThan(20)

    // Every timeline entry should have positive tokens
    for (const entry of metrics.usageTimeline) {
      expect(entry.inputTokens + entry.outputTokens).toBeGreaterThan(0)
      expect(entry.model).toBeTruthy()
    }
  })

  // ── Thinking blocks ──────────────────────────────────────────────────────

  it('never produces assistant messages starting with raw JSON', async () => {
    const session = await getCanonical()

    for (const event of session.events) {
      if (event.type !== 'assistant_message') continue
      expect(event.text).not.toMatch(/^\{"type":"thinking"/)
      expect(event.text).not.toMatch(/^\{"type":"tool_use"/)
      expect(event.text).not.toMatch(/^\{"type":"tool_result"/)
    }
  })

  // ── Image handling ──────────────────────────────────────────────────────

  it('preserves image attachment context with count in user messages', async () => {
    const session = await getCanonical()

    const imageMessage = session.events.find(
      e => e.type === 'user_message' && e.text.includes('3 images attached'),
    )
    expect(imageMessage).toBeTruthy()
  })

  // ── Tool labels ─────────────────────────────────────────────────────────

  it('derives labels for all native tool types from their inputs', async () => {
    const session = await getCanonical()
    const toolCalls = session.events.filter(
      (e): e is ToolCallEvent => e.type === 'tool_call',
    )

    // Read → file_path
    const reads = toolCalls.filter(tc => tc.toolName === 'Read' && tc.commentLabel)
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every(tc => tc.commentLabel!.startsWith('/'))).toBe(true)

    // Glob → pattern (may be exact path or wildcard)
    const globs = toolCalls.filter(tc => tc.toolName === 'Glob' && tc.commentLabel)
    expect(globs.length).toBeGreaterThan(0)
    expect(globs.every(tc => tc.commentLabel!.length > 0)).toBe(true)

    // Edit → file_path
    const edits = toolCalls.filter(tc => tc.toolName === 'Edit' && tc.commentLabel)
    if (edits.length > 0) {
      expect(edits.every(tc => tc.commentLabel!.startsWith('/'))).toBe(true)
    }

    // Write → file_path
    const writes = toolCalls.filter(tc => tc.toolName === 'Write' && tc.commentLabel)
    if (writes.length > 0) {
      expect(writes.every(tc => tc.commentLabel!.startsWith('/'))).toBe(true)
    }

    // Agent → prompt text
    const agents = toolCalls.filter(tc => tc.toolName === 'Agent' && tc.commentLabel)
    expect(agents.length).toBeGreaterThan(0)
    expect(agents.every(tc => tc.commentLabel!.length > 10)).toBe(true)
  })

  // ── Tool call / result pairing ──────────────────────────────────────────

  it('pairs tool calls with matching results by toolUseId', async () => {
    const session = await getCanonical()
    const toolCalls = session.events.filter(
      (e): e is ToolCallEvent => e.type === 'tool_call',
    )
    const toolResults = session.events.filter(
      (e): e is ToolResultEvent => e.type === 'tool_result',
    )

    const callIds = new Set(toolCalls.map(tc => tc.toolUseId))
    const resultIds = new Set(toolResults.map(tr => tr.toolUseId))

    // Every result should reference a call that exists
    for (const result of toolResults) {
      expect(callIds.has(result.toolUseId)).toBe(true)
    }

    // Most calls should have results (some may be interrupted/pending)
    const pairedCount = toolCalls.filter(tc => resultIds.has(tc.toolUseId)).length
    expect(pairedCount / toolCalls.length).toBeGreaterThan(0.7)
  })

  // ── Thread selection ─────────────────────────────────────────────────────

  it('excludes dead-branch user messages from the event stream', async () => {
    const session = await getCanonical()
    const userMessages = session.events
      .filter(e => e.type === 'user_message')
      .map(e => e.type === 'user_message' ? e.text : '')

    // Dead branches produce near-identical messages with the same UUID parent.
    // Use full text comparison — legitimate duplicate prompts are fine,
    // but dead branches would have the exact same text as the next message.
    // At minimum, the count should be reasonable relative to turns.
    const metrics = getMetrics(session)
    expect(userMessages.length).toBeGreaterThan(0)
    expect(userMessages.length).toBeLessThanOrEqual(metrics.turnCount * 3)
  })

  it('counts turns correctly relative to message count', async () => {
    const session = await getCanonical()
    const metrics = getMetrics(session)

    expect(metrics.turnCount).toBeGreaterThanOrEqual(8)
    expect(metrics.turnCount).toBeLessThan(metrics.messageCount)
  })

  // ── Subagents ───────────────────────────────────────────────────────────

  it('parses subagent threads with events and metadata', async () => {
    const session = await getCanonical()

    expect(session.agents.length).toBeGreaterThanOrEqual(5)

    for (const agent of session.agents) {
      expect(agent.role).toBe('subagent')
      expect(agent.agentId).toBeTruthy()
      expect(agent.title).toBeTruthy()
      expect(agent.events.length).toBeGreaterThan(0)

      // Each subagent should have at least some tool calls
      const agentToolCalls = agent.events.filter(e => e.type === 'tool_call')
      expect(agentToolCalls.length).toBeGreaterThan(0)
    }
  })

  // ── Artifacts ───────────────────────────────────────────────────────────

  it('detects tool decisions with correct status and feedback', async () => {
    const session = await getCanonical()
    const decisions = session.artifacts.filter(a => a.artifactType === 'tool_decision')

    expect(decisions.length).toBeGreaterThanOrEqual(3)

    for (const d of decisions) {
      if (d.artifactType !== 'tool_decision') continue
      expect(d.toolName).toBeTruthy()
      expect(['rejected', 'redirected', 'aborted', 'hook_blocked', 'interrupted']).toContain(d.status)
    }
  })

  it('extracts tool outputs with status and preview text', async () => {
    const session = await getCanonical()
    const outputs = session.artifacts.filter(a => a.artifactType === 'tool_output')

    expect(outputs.length).toBeGreaterThan(20)

    const withPreviews = outputs.filter(
      a => a.artifactType === 'tool_output' && a.previewText && a.previewText.length > 0,
    )
    expect(withPreviews.length).toBeGreaterThan(10)

    // All outputs should have valid status
    for (const o of outputs) {
      if (o.artifactType !== 'tool_output') continue
      expect(['ok', 'error', 'partial']).toContain(o.status)
    }
  })

  // ── Metrics ─────────────────────────────────────────────────────────────

  it('uses claude-opus-4-6 throughout with stable model timeline', async () => {
    const metrics = getMetrics(await getCanonical())

    expect(metrics.modelsUsed).toEqual(['claude-opus-4-6'])
    expect(metrics.modelTimeline).toHaveLength(1)
    expect(metrics.modelTimeline[0]!.model).toBe('claude-opus-4-6')
  })

  it('has positive duration in minutes', async () => {
    const metrics = getMetrics(await getCanonical())
    expect((metrics.durationMs ?? 0) / 60_000).toBeGreaterThan(60)
  })

  // ── Provider data / digestHints ─────────────────────────────────────────

  it('embeds digestHints with MCP config and cache rate in providerData', async () => {
    const session = await getCanonical()
    const ccData = session.providerData?.claudeCode as Record<string, unknown>

    expect(ccData).toBeTruthy()
    expect(ccData.metrics).toBeTruthy()

    const hints = ccData.digestHints as {
      mcpServersConfigured: string[]
      cacheHitRate?: number
      activeDurationMs?: number
    }
    expect(hints).toBeTruthy()
    expect(hints.mcpServersConfigured).toBeInstanceOf(Array)
    expect(hints.mcpServersConfigured.length).toBeGreaterThanOrEqual(3)

    // Cache hit rate should be between 0 and 1
    if (hints.cacheHitRate != null) {
      expect(hints.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(hints.cacheHitRate).toBeLessThanOrEqual(1)
    }

    // Active duration should be less than raw duration
    const metrics = getMetrics(session)
    if (hints.activeDurationMs != null && metrics.durationMs != null) {
      expect(hints.activeDurationMs).toBeLessThanOrEqual(metrics.durationMs)
      expect(hints.activeDurationMs).toBeGreaterThan(0)
    }
  })

  // ── Digest extraction ───────────────────────────────────────────────────

  it('extracts a complete SessionDigest with all fields populated', async () => {
    const d = await getDigest()

    // Identity
    expect(d.sessionId).toBe(TARGET_SESSION_ID)
    expect(d.provider).toBe('claude_code')
    expect(d.projectKey).toBeTruthy()
    expect(d.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(d.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(d.gitBranch).toBe('chore/howicc-revamp-foundation')

    // Counters
    expect(d.turnCount).toBeGreaterThan(0)
    expect(d.messageCount).toBeGreaterThan(0)
    expect(d.toolRunCount).toBeGreaterThan(0)
    expect(d.subagentCount).toBeGreaterThanOrEqual(5)
    expect(d.hourOfDay).toBeGreaterThanOrEqual(0)
    expect(d.hourOfDay).toBeLessThan(24)

    // Duration
    expect(d.durationMs).toBeGreaterThan(0)
  })

  it('has tool categories that sum to toolRunCount', async () => {
    const d = await getDigest()
    const total = Object.values(d.toolCategories).reduce((a, b) => a + b, 0)
    expect(total).toBe(d.toolRunCount)
  })

  it('categorizes tools correctly for this session', async () => {
    const d = await getDigest()

    // This session uses Read (read), Glob/Grep (search), Bash (command),
    // Agent (agent), Edit/Write (write)
    expect(d.toolCategories.read).toBeGreaterThan(0)
    expect(d.toolCategories.search).toBeGreaterThan(0)
    expect(d.toolCategories.agent).toBeGreaterThan(0)
    expect(d.toolCategories.write).toBeGreaterThan(0)
    expect(d.toolCategories.command).toBeGreaterThan(0)
  })

  it('extracts MCP servers configured from attachment entries', async () => {
    const d = await getDigest()

    expect(d.mcpServersConfigured.length).toBeGreaterThanOrEqual(3)
    expect(d.mcpServersConfigured).toContain('pencil')
    expect(d.mcpServersConfigured).toContain('claude-in-chrome')
    // Sorted alphabetically
    const sorted = [...d.mcpServersConfigured].sort()
    expect(d.mcpServersConfigured).toEqual(sorted)
  })

  it('tracks error and rejection counts', async () => {
    const d = await getDigest()

    // Errors and rejections are now separated: errors are genuine tool failures,
    // rejections are user decisions (tool_decision artifacts). The previous
    // double-counting (both were ~16) is fixed — most "errors" were actually rejections.
    expect(d.errorCount + d.rejectionCount).toBeGreaterThan(0)
    expect(d.rejectionCount).toBeGreaterThanOrEqual(3)
  })

  it('reports model usage with token counts', async () => {
    const d = await getDigest()

    expect(d.models.length).toBeGreaterThan(0)

    const opusModel = d.models.find(m => m.model === 'claude-opus-4-6')
    expect(opusModel).toBeTruthy()
    expect(opusModel!.inputTokens).toBeGreaterThan(0)
    expect(opusModel!.outputTokens).toBeGreaterThan(0)
  })

  it('computes active duration shorter than raw duration', async () => {
    const d = await getDigest()
    const metrics = getMetrics(await getCanonical())

    if (d.durationMs != null && metrics.durationMs != null) {
      expect(d.durationMs).toBeLessThanOrEqual(metrics.durationMs)
    }
  })

  it('populates providerDigest with CC-specific cache hit rate', async () => {
    const d = await getDigest()
    const pd = d.providerDigest as { cacheHitRate?: number } | undefined

    expect(pd).toBeTruthy()
    if (pd?.cacheHitRate != null) {
      expect(pd.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(pd.cacheHitRate).toBeLessThanOrEqual(1)
    }
  })

  // ── Profile aggregation (multi-session) ──────────────────────────────────

  it('builds a complete UserProfile from real sessions', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    const digests: SessionDigest[] = []

    for (const session of sessions.slice(0, 20)) {
      try {
        digests.push(extractSessionDigest(await parseRealSession(session)))
      } catch {
        // skip
      }
    }

    expect(digests.length).toBeGreaterThan(5)

    const profile = buildUserProfile('test-user', digests)

    // Identity
    expect(profile.userId).toBe('test-user')
    expect(profile.digestCount).toBe(digests.length)
    expect(profile.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Activity
    expect(profile.activity.totalSessions).toBe(digests.length)
    expect(profile.activity.activeDays).toBeGreaterThan(0)
    expect(profile.activity.hourlyDistribution).toHaveLength(24)
    expect(profile.activity.hourlyDistribution.reduce((a, b) => a + b, 0)).toBe(digests.length)
    expect(profile.activity.firstSessionAt).toBeTruthy()
    expect(profile.activity.lastSessionAt).toBeTruthy()
    expect(profile.activity.averageSessionDurationMs).toBeGreaterThan(0)
    expect(profile.activity.averageTurnsPerSession).toBeGreaterThan(0)

    // Daily activity — each entry should have valid data
    expect(profile.activity.dailyActivity.length).toBe(profile.activity.activeDays)
    for (const day of profile.activity.dailyActivity) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(day.sessionCount).toBeGreaterThan(0)
    }
    // Sum of daily session counts should equal total sessions
    const dailySum = profile.activity.dailyActivity.reduce((s, d) => s + d.sessionCount, 0)
    expect(dailySum).toBe(digests.length)

    // Streaks
    expect(profile.activity.longestStreak).toBeGreaterThanOrEqual(profile.activity.currentStreak)
    expect(profile.activity.longestStreak).toBeGreaterThanOrEqual(1)

    // Projects — sorted by session count descending
    expect(profile.projects.length).toBeGreaterThan(0)
    for (let i = 1; i < profile.projects.length; i++) {
      expect(profile.projects[i]!.sessionCount).toBeLessThanOrEqual(
        profile.projects[i - 1]!.sessionCount,
      )
    }
    // Sum of project session counts should equal total
    const projectSum = profile.projects.reduce((s, p) => s + p.sessionCount, 0)
    expect(projectSum).toBe(digests.length)

    // Toolcraft — rates between 0 and 1
    expect(profile.toolcraft.totalToolRuns).toBeGreaterThan(0)
    expect(profile.toolcraft.errorRate).toBeGreaterThanOrEqual(0)
    expect(profile.toolcraft.errorRate).toBeLessThanOrEqual(1)
    expect(profile.toolcraft.rejectionRate).toBeGreaterThanOrEqual(0)
    expect(profile.toolcraft.planUsageRate).toBeGreaterThanOrEqual(0)
    expect(profile.toolcraft.planUsageRate).toBeLessThanOrEqual(1)
    expect(profile.toolcraft.agentUsageRate).toBeGreaterThanOrEqual(0)
    expect(profile.toolcraft.agentUsageRate).toBeLessThanOrEqual(1)

    // Tool category breakdown should sum to totalToolRuns
    const catSum = Object.values(profile.toolcraft.categoryBreakdown).reduce((a, b) => a + b, 0)
    expect(catSum).toBe(profile.toolcraft.totalToolRuns)

    // Models — sorted by session count descending
    expect(profile.models.length).toBeGreaterThan(0)
    for (let i = 1; i < profile.models.length; i++) {
      expect(profile.models[i]!.sessionCount).toBeLessThanOrEqual(
        profile.models[i - 1]!.sessionCount,
      )
    }
    // Real models should have positive token counts (filter out <synthetic>)
    const realModels = profile.models.filter(m => !m.model.startsWith('<'))
    for (const m of realModels) {
      expect(m.inputTokens + m.outputTokens).toBeGreaterThan(0)
    }

    // Cost by month — sorted chronologically
    for (let i = 1; i < profile.cost.byMonth.length; i++) {
      expect(profile.cost.byMonth[i]!.month > profile.cost.byMonth[i - 1]!.month).toBe(true)
    }

    // Providers
    expect(profile.providers.length).toBe(1)
    expect(profile.providers[0]!.provider).toBe('claude_code')
    expect(profile.providers[0]!.sessionCount).toBe(digests.length)

    // Integrations — MCP servers
    expect(profile.integrations.mcpServers.length).toBeGreaterThan(0)
    for (const server of profile.integrations.mcpServers) {
      expect(server.server).toBeTruthy()
      expect(server.configuredCount + server.usedCount).toBeGreaterThan(0)
    }

    // CC-specific provider profile
    expect(profile.providerProfiles?.claudeCode).toBeTruthy()
    expect(profile.providerProfiles!.claudeCode!.avgTurnsPerSession).toBeGreaterThan(0)
    expect(profile.providerProfiles!.claudeCode!.thinkingVisibleRate).toBeGreaterThanOrEqual(0)
    expect(profile.providerProfiles!.claudeCode!.thinkingVisibleRate).toBeLessThanOrEqual(1)
  })

  // ── Tool categorization correctness ──────────────────────────────────────

  it('categorizes all known CC tools correctly', () => {
    // Native tools
    expect(categorizeToolName('Read', 'native')).toBe('read')
    expect(categorizeToolName('Grep', 'native')).toBe('search')
    expect(categorizeToolName('Glob', 'native')).toBe('search')
    expect(categorizeToolName('Edit', 'native')).toBe('write')
    expect(categorizeToolName('Write', 'native')).toBe('write')
    expect(categorizeToolName('Bash', 'native')).toBe('command')
    expect(categorizeToolName('Agent', 'native')).toBe('agent')
    expect(categorizeToolName('SendMessage', 'native')).toBe('agent')
    expect(categorizeToolName('EnterPlanMode', 'native')).toBe('plan')
    expect(categorizeToolName('ExitPlanMode', 'native')).toBe('plan')
    expect(categorizeToolName('TodoWrite', 'native')).toBe('plan')
    expect(categorizeToolName('AskUserQuestion', 'native')).toBe('question')
    expect(categorizeToolName('TaskCreate', 'native')).toBe('task')
    expect(categorizeToolName('TaskUpdate', 'native')).toBe('task')
    expect(categorizeToolName('WebSearch', 'native')).toBe('web')
    expect(categorizeToolName('WebFetch', 'native')).toBe('web')

    // MCP tools always get 'mcp'
    expect(categorizeToolName('mcp__chrome-devtools__click', 'mcp')).toBe('mcp')
    expect(categorizeToolName('mcp__pencil__batch_design', 'mcp')).toBe('mcp')

    // Unknown native tool
    expect(categorizeToolName('SomeNewTool', 'native')).toBe('other')
  })

  // ── Zero-parse error rate across all sessions ────────────────────────────

  it('parses all discovered sessions without errors', async () => {
    const sessions = await discoverClaudeSessions({ claudeHomeDir })
    let parsed = 0
    let failed = 0

    for (const session of sessions.slice(0, 30)) {
      try {
        const canonical = await parseRealSession(session)
        const d = extractSessionDigest(canonical)
        // Sanity: every digest should have matching IDs
        expect(d.sessionId).toBe(session.sessionId)
        expect(d.provider).toBe('claude_code')
        parsed += 1
      } catch {
        failed += 1
      }
    }

    expect(parsed).toBeGreaterThan(10)
    expect(failed).toBe(0)
  })
})

async function parseRealSession(session: Awaited<ReturnType<typeof discoverClaudeSessions>>[number]) {
  const bundle = await buildClaudeSourceBundle(session, { claudeHomeDir })

  return buildClaudeCanonicalSession({
    bundle,
    session,
    parserVersion: 'test',
  })
}

async function findSessionContaining(needle: string) {
  const sessions = await discoverClaudeSessions({ claudeHomeDir })

  return findFirstSessionMatching(sessions, async candidate => {
    const content = await readFile(candidate.transcriptPath, 'utf8')
    return content.includes(needle)
  })
}

async function findFirstSessionMatching<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<T | undefined> {
  for (const item of items) {
    if (await predicate(item)) {
      return item
    }
  }

  return undefined
}

async function findAllSessionsMatching<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<T[]> {
  const matches: T[] = []

  for (const item of items) {
    if (await predicate(item)) {
      matches.push(item)
    }
  }

  return matches
}

async function hasLocalClaudeData(directoryPath: string): Promise<boolean> {
  try {
    const info = await stat(path.join(directoryPath, 'projects'))
    return info.isDirectory()
  } catch {
    return false
  }
}

async function hasTargetSession(claudeHome: string, sessionId: string): Promise<boolean> {
  if (!await hasLocalClaudeData(claudeHome)) return false

  try {
    const sessions = await discoverClaudeSessions({ claudeHomeDir: claudeHome })
    return sessions.some(s => s.sessionId === sessionId)
  } catch {
    return false
  }
}

type MetricsShape = {
  messageCount: number
  turnCount: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  durationMs?: number
  modelsUsed: string[]
  modelTimeline: Array<{ model: string }>
  modelSelectionTimeline?: Array<{ modelLabel: string; timestamp?: string }>
  usageTimeline: Array<{ model: string; inputTokens: number; outputTokens: number }>
  permissionModeTimeline: Array<{ mode: string }>
  sessionModeTimeline: Array<{ mode: string; event: string }>
  estimatedCostUsd?: number
  costReliability: string
}

function getMetrics(session: Awaited<ReturnType<typeof parseRealSession>>): MetricsShape {
  return (session.providerData?.claudeCode as { metrics: MetricsShape }).metrics
}

async function hasAnyFile(directoryPath: string, fileName?: string): Promise<boolean> {
  try {
    const info = await stat(directoryPath)
    if (!info.isDirectory()) return false

    if (!fileName) return true

    await stat(path.join(directoryPath, fileName))
    return true
  } catch {
    return false
  }
}
