import type {
  AgentThread,
  CanonicalEvent,
  CanonicalSession,
  HookEvent,
  SessionArtifact,
  ToolCallEvent,
  ToolResultEvent,
} from '@howicc/canonical'
import type { OpenRouterCatalog } from '@howicc/model-pricing'
import {
  createSourceRevisionHashFromFiles,
  type DiscoveredSession,
  type SourceBundle,
} from '@howicc/parser-core'
import { parseJsonlFile } from '../jsonl'
import { buildAssetRefs } from '../parse/buildAssetRefs'
import { buildEvents } from '../parse/buildEvents'
import { buildSessionMetadata } from '../parse/metadata'
import { buildClaudeCodeMetrics } from '../parse/metrics'
import { selectActiveThread } from '../parse/selectActiveThread'
import { extractDigestHints } from '../parse/digestHints'
import { extractPlanArtifacts, extractQuestionArtifacts, extractTodoArtifacts, extractToolDecisionArtifacts, extractToolOutputArtifacts } from '../extractors'
import { buildSearchText } from './buildSearchText'

export const buildClaudeCanonicalSession = async (input: {
  bundle: SourceBundle
  session: DiscoveredSession
  parserVersion: string
  pricingCatalog?: OpenRouterCatalog
}): Promise<CanonicalSession> => {
  const rawEntries = await parseJsonlFile(input.bundle.manifest.transcript.absolutePath)
  const selection = selectActiveThread(rawEntries)
  const assets = await buildAssetRefs(input.bundle)
  const transcriptFile = input.bundle.files.find(file => file.kind === 'transcript')
  const sourceRevisionHash = createSourceRevisionHashFromFiles(input.bundle.files)

  if (!transcriptFile) {
    throw new Error('Source bundle is missing the transcript file.')
  }

  const assetIdByAbsolutePath = new Map(
    assets
      .map(asset => {
        const absolutePath = asset.providerData?.absolutePath
        return typeof absolutePath === 'string' ? ([absolutePath, asset.id] as const) : undefined
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  )

  const events = buildEvents(selection.selectedEntries, assetIdByAbsolutePath)
  const toolCalls = events.filter(
    (event): event is ToolCallEvent => event.type === 'tool_call',
  )
  const toolResults = events.filter(
    (event): event is ToolResultEvent => event.type === 'tool_result',
  )
  const hooks = events.filter((event): event is HookEvent => event.type === 'hook')
  const agents = await parseAgentThreads(input.bundle, assetIdByAbsolutePath)

  const artifacts = [
    ...(await extractPlanArtifacts({
      bundle: input.bundle,
      assets,
      toolCalls,
      toolResults,
    })),
    ...extractQuestionArtifacts({ toolCalls, toolResults }),
    ...extractTodoArtifacts({ toolCalls }),
    ...extractToolDecisionArtifacts({ toolCalls, toolResults, hooks }),
    ...extractToolOutputArtifacts({ toolCalls, toolResults }),
  ] satisfies SessionArtifact[]

  const metadata = buildSessionMetadata(
    rawEntries,
    selection.selectedEntries,
    input.session,
  )
  const metrics = buildClaudeCodeMetrics(rawEntries, {
    catalog: input.pricingCatalog,
    selectedEntries: selection.selectedEntries,
  })
  const digestHints = await extractDigestHints(rawEntries, metrics, {
    cwd: metadata.cwd,
  })

  return {
    kind: 'canonical_session',
    schemaVersion: 1,
    parserVersion: input.parserVersion,
    provider: 'claude_code',
    source: {
      sessionId: input.bundle.sessionId,
      projectKey: input.bundle.projectKey,
      projectPath: input.bundle.projectPath,
      sourceRevisionHash,
      transcriptSha256: transcriptFile.sha256,
      importedAt: input.bundle.capturedAt,
    },
    metadata,
    selection: {
      strategy: 'latest_leaf',
      selectedLeafUuid: selection.selectedLeafUuid,
      branchCount: selection.branchCount,
    },
    stats: {
      visibleMessageCount: events.filter(
        event => event.type === 'user_message' || event.type === 'assistant_message',
      ).length,
      toolRunCount: toolCalls.length,
      artifactCount: artifacts.length,
      subagentCount: agents.length,
    },
    events,
    agents,
    assets,
    artifacts,
    searchText: buildSearchText({ metadata, events, artifacts }),
    providerData: {
      claudeCode: {
        slug: input.bundle.manifest.slug,
        cwd: input.bundle.manifest.cwd,
        gitBranch: input.bundle.manifest.gitBranch,
        metrics,
        digestHints,
      },
    },
  }
}

const parseAgentThreads = async (
  bundle: SourceBundle,
  assetIdByAbsolutePath: Map<string, string>,
): Promise<AgentThread[]> => {
  return Promise.all(
    bundle.manifest.subagents.map(async subagent => {
      const rawEntries = await parseJsonlFile(subagent.transcriptAbsolutePath)
      const selection = selectActiveThread(rawEntries, { includeSidechain: true })

      return {
        agentId: subagent.agentId,
        title: subagent.description,
        role: 'subagent',
        events: buildEvents(selection.selectedEntries, assetIdByAbsolutePath) as CanonicalEvent[],
        metadata: {
          agentType: subagent.agentType,
          description: subagent.description,
        },
      }
    }),
  )
}
