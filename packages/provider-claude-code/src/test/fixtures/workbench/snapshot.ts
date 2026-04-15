/**
 * Workbench: Run the full pipeline on a real session and snapshot every step.
 * Saves each intermediate output as JSON for inspection and diffing.
 *
 * Usage: ./node_modules/.bin/tsx src/test/fixtures/workbench/snapshot.ts [sessionId] [outputDir]
 *
 * If no sessionId: uses the most recent session.
 * If no outputDir: uses src/test/fixtures/workbench/v1/
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildClaudeCanonicalSession } from '../../../canonical'
import { buildClaudeSourceBundle } from '../../../bundle'
import { discoverClaudeSessions } from '../../../discover'
import { getClaudeHomeDir } from '../../../claudePaths'
import { extractSessionDigest, buildUserProfile } from '@howicc/profile'
import type { CanonicalSession } from '@howicc/canonical'

const sessionId = process.argv[2]
const outputDir = process.argv[3] ?? path.join(import.meta.dirname, 'v1')

const claudeHomeDir = getClaudeHomeDir()

const writeJson = async (name: string, data: unknown) => {
  const filePath = path.join(outputDir, `${name}.json`)
  await writeFile(filePath, JSON.stringify(data, null, 2))
  const size = Buffer.byteLength(JSON.stringify(data))
  console.log(`  ✓ ${name}.json (${(size / 1024).toFixed(1)}KB)`)
}

const main = async () => {
  await mkdir(outputDir, { recursive: true })
  console.log(`Workbench output: ${outputDir}\n`)

  // ── Step 1: Discovery ────────────────────────────────────────────────────
  console.log('Step 1: discoverClaudeSessions()')
  const allSessions = await discoverClaudeSessions({ claudeHomeDir })
  console.log(`  Found ${allSessions.length} sessions`)

  const target = sessionId
    ? allSessions.find(s => s.sessionId === sessionId || s.sessionId.startsWith(sessionId))
    : allSessions[0]

  if (!target) {
    console.error(`Session ${sessionId ?? 'latest'} not found`)
    process.exit(1)
  }

  console.log(`  Target: ${target.sessionId}`)
  console.log(`  Project: ${target.projectKey}`)
  console.log(`  Preview: ${target.firstPromptPreview?.slice(0, 80) ?? '(none)'}`)

  await writeJson('01-discovered-session', target)
  await writeJson('01-all-discovered-sessions', allSessions.map(s => ({
    sessionId: s.sessionId,
    projectKey: s.projectKey,
    sizeBytes: s.sizeBytes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    firstPromptPreview: s.firstPromptPreview?.slice(0, 100),
    gitBranch: s.gitBranch,
    slug: s.slug,
  })))

  // ── Step 2: Bundle ───────────────────────────────────────────────────────
  console.log('\nStep 2: buildClaudeSourceBundle()')
  const bundle = await buildClaudeSourceBundle(target, { claudeHomeDir })
  console.log(`  Files: ${bundle.files.length}`)
  console.log(`  Subagents: ${bundle.manifest.subagents.length}`)
  console.log(`  Tool results: ${bundle.manifest.toolResults.length}`)
  console.log(`  Plan files: ${bundle.manifest.planFiles.length}`)

  // Save bundle manifest (not full file contents)
  await writeJson('02-source-bundle-manifest', {
    kind: bundle.kind,
    version: bundle.version,
    provider: bundle.provider,
    sessionId: bundle.sessionId,
    projectKey: bundle.projectKey,
    projectPath: bundle.projectPath,
    capturedAt: bundle.capturedAt,
    fileCount: bundle.files.length,
    files: bundle.files.map(f => ({
      id: f.id,
      relPath: f.relPath,
      kind: f.kind,
      sha256: f.sha256.slice(0, 16),
      bytes: f.bytes,
    })),
    manifest: {
      transcript: bundle.manifest.transcript,
      slug: bundle.manifest.slug,
      cwd: bundle.manifest.cwd,
      gitBranch: bundle.manifest.gitBranch,
      subagents: bundle.manifest.subagents.map(s => ({
        agentId: s.agentId,
        agentType: s.agentType,
        description: s.description,
      })),
      planFiles: bundle.manifest.planFiles,
      toolResultCount: bundle.manifest.toolResults.length,
      warnings: bundle.manifest.warnings,
    },
  })

  // ── Step 3: Canonical Session ────────────────────────────────────────────
  console.log('\nStep 3: buildClaudeCanonicalSession()')
  const canonical = await buildClaudeCanonicalSession({
    bundle,
    session: target,
    parserVersion: 'workbench-v1',
  })

  console.log(`  Events: ${canonical.events.length}`)
  console.log(`  Artifacts: ${canonical.artifacts.length}`)
  console.log(`  Agents: ${canonical.agents.length}`)
  console.log(`  Assets: ${canonical.assets.length}`)

  // Save full canonical (minus heavy content)
  await writeJson('03-canonical-session', {
    kind: canonical.kind,
    schemaVersion: canonical.schemaVersion,
    parserVersion: canonical.parserVersion,
    provider: canonical.provider,
    source: canonical.source,
    metadata: canonical.metadata,
    selection: canonical.selection,
    stats: canonical.stats,
    providerData: canonical.providerData,
    agentCount: canonical.agents.length,
    assetCount: canonical.assets.length,
    searchTextLength: canonical.searchText.length,
  })

  // Save events separately (these are large)
  await writeJson('03-events', canonical.events)

  // Save artifacts separately
  await writeJson('03-artifacts', canonical.artifacts)

  // Save agents with their event counts
  await writeJson('03-agents', canonical.agents.map(a => ({
    agentId: a.agentId,
    title: a.title,
    role: a.role,
    eventCount: a.events.length,
    metadata: a.metadata,
    eventTypes: countEventTypes(a.events),
  })))

  // Save assets
  await writeJson('03-assets', canonical.assets.map(a => ({
    id: a.id,
    kind: a.kind,
    storage: a.storage,
    relPath: a.relPath,
    bytes: a.bytes,
    sha256: a.sha256?.slice(0, 16),
  })))

  // ── Step 3b: Event Analysis ──────────────────────────────────────────────
  const eventAnalysis = analyzeEvents(canonical)
  await writeJson('03-event-analysis', eventAnalysis)

  // ── Step 3c: Tool Catalog ────────────────────────────────────────────────
  const toolCatalog = buildToolCatalog(canonical)
  await writeJson('03-tool-catalog', toolCatalog)

  // ── Step 4: Digest ───────────────────────────────────────────────────────
  console.log('\nStep 4: extractSessionDigest()')
  const digest = extractSessionDigest(canonical)
  console.log(`  Turn count: ${digest.turnCount}`)
  console.log(`  Tool runs: ${digest.toolRunCount}`)
  console.log(`  MCP configured: ${digest.mcpServersConfigured.join(', ')}`)
  console.log(`  Skills: ${digest.skillsTriggered.map(s => s.name).join(', ') || '(none)'}`)
  console.log(`  Commands: ${digest.commandsInvoked.map(command => command.name).join(', ') || '(none)'}`)

  await writeJson('04-session-digest', digest)

  // ── Step 5: Profile (multi-session) ──────────────────────────────────────
  console.log('\nStep 5: buildUserProfile() from all sessions')
  const digests = []
  let errors = 0

  for (let i = 0; i < allSessions.length; i++) {
    try {
      const b = await buildClaudeSourceBundle(allSessions[i]!, { claudeHomeDir })
      const c = await buildClaudeCanonicalSession({
        bundle: b,
        session: allSessions[i]!,
        parserVersion: 'workbench-v1',
      })
      digests.push(extractSessionDigest(c))
    } catch {
      errors += 1
    }
    process.stdout.write(`\r  Parsed ${i + 1}/${allSessions.length} (${errors} errors)`)
  }
  console.log('')

  const profile = buildUserProfile('workbench-user', digests)
  console.log(`  Sessions: ${profile.activity.totalSessions}`)
  console.log(`  Active days: ${profile.activity.activeDays}`)
  console.log(`  Projects: ${profile.projects.length}`)
  console.log(`  Models: ${profile.models.map(m => m.model).join(', ')}`)

  await writeJson('05-user-profile', profile)
  await writeJson('05-all-digests', digests)

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══ Workbench complete ═══')
  console.log(`Output directory: ${outputDir}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const countEventTypes = (events: CanonicalSession['events']) => {
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1
  }
  return counts
}

const analyzeEvents = (session: CanonicalSession) => {
  const eventTypes = countEventTypes(session.events)

  // Tool call analysis
  const toolCalls = session.events.filter(e => e.type === 'tool_call') as Array<{
    type: 'tool_call'
    toolName: string
    displayName: string
    source: string
    commentLabel?: string
    mcpServerName?: string
    input: unknown
  }>

  const toolNameCounts: Record<string, number> = {}
  const toolsBySource: Record<string, string[]> = { native: [], mcp: [], repl_virtual: [] }
  const labelsPresent: Record<string, { total: number; withLabel: number }> = {}

  for (const tc of toolCalls) {
    toolNameCounts[tc.toolName] = (toolNameCounts[tc.toolName] ?? 0) + 1

    if (!toolsBySource[tc.source]!.includes(tc.toolName)) {
      toolsBySource[tc.source]!.push(tc.toolName)
    }

    if (!labelsPresent[tc.toolName]) {
      labelsPresent[tc.toolName] = { total: 0, withLabel: 0 }
    }
    labelsPresent[tc.toolName]!.total += 1
    if (tc.commentLabel) labelsPresent[tc.toolName]!.withLabel += 1
  }

  // Tool result analysis
  const toolResults = session.events.filter(e => e.type === 'tool_result') as Array<{
    type: 'tool_result'
    status: string
    text?: string
  }>

  const resultStatusCounts: Record<string, number> = {}
  for (const tr of toolResults) {
    resultStatusCounts[tr.status] = (resultStatusCounts[tr.status] ?? 0) + 1
  }

  // Message analysis
  const userMessages = session.events.filter(e => e.type === 'user_message') as Array<{
    type: 'user_message'
    text: string
    isMeta?: boolean
  }>
  const assistantMessages = session.events.filter(e => e.type === 'assistant_message') as Array<{
    type: 'assistant_message'
    text: string
    isMeta?: boolean
  }>

  const thinkingMessages = assistantMessages.filter(m => m.isMeta === true)

  return {
    eventTypeCounts: eventTypes,
    toolNameCounts: Object.fromEntries(
      Object.entries(toolNameCounts).sort((a, b) => b[1] - a[1]),
    ),
    toolsBySource,
    toolLabelCoverage: Object.fromEntries(
      Object.entries(labelsPresent)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, stats]) => [
          name,
          { ...stats, coverage: `${Math.round(stats.withLabel / stats.total * 100)}%` },
        ]),
    ),
    resultStatusCounts,
    messageStats: {
      userMessages: userMessages.length,
      userMessagesWithMeta: userMessages.filter(m => m.isMeta).length,
      assistantMessages: assistantMessages.length,
      thinkingMessages: thinkingMessages.length,
      regularAssistantMessages: assistantMessages.length - thinkingMessages.length,
    },
    artifactTypes: session.artifacts.reduce<Record<string, number>>((acc, a) => {
      acc[a.artifactType] = (acc[a.artifactType] ?? 0) + 1
      return acc
    }, {}),
  }
}

const buildToolCatalog = (session: CanonicalSession) => {
  const toolCalls = session.events.filter(e => e.type === 'tool_call') as Array<{
    type: 'tool_call'
    toolName: string
    displayName: string
    source: string
    commentLabel?: string
    mcpServerName?: string
    input: unknown
  }>

  const catalog: Record<string, {
    toolName: string
    displayName: string
    source: string
    mcpServerName?: string
    callCount: number
    inputKeys: string[]
    sampleLabels: string[]
    sampleInputs: Array<Record<string, unknown>>
  }> = {}

  for (const tc of toolCalls) {
    if (!catalog[tc.toolName]) {
      catalog[tc.toolName] = {
        toolName: tc.toolName,
        displayName: tc.displayName,
        source: tc.source,
        mcpServerName: tc.mcpServerName,
        callCount: 0,
        inputKeys: [],
        sampleLabels: [],
        sampleInputs: [],
      }
    }

    const entry = catalog[tc.toolName]!
    entry.callCount += 1

    // Collect unique input keys
    if (tc.input && typeof tc.input === 'object') {
      for (const key of Object.keys(tc.input as Record<string, unknown>)) {
        if (!entry.inputKeys.includes(key)) {
          entry.inputKeys.push(key)
        }
      }
    }

    // Collect sample labels (up to 3)
    if (tc.commentLabel && entry.sampleLabels.length < 3 && !entry.sampleLabels.includes(tc.commentLabel)) {
      entry.sampleLabels.push(tc.commentLabel.slice(0, 120))
    }

    // Collect sample inputs (up to 2, truncated)
    if (entry.sampleInputs.length < 2 && tc.input && typeof tc.input === 'object') {
      const truncated: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(tc.input as Record<string, unknown>)) {
        if (typeof value === 'string' && value.length > 200) {
          truncated[key] = value.slice(0, 200) + '...'
        } else {
          truncated[key] = value
        }
      }
      entry.sampleInputs.push(truncated)
    }
  }

  return Object.values(catalog).sort((a, b) => b.callCount - a.callCount)
}

main().catch(console.error)
