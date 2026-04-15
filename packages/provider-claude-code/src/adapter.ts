import type { CanonicalSession } from '@howicc/canonical'
import type { OpenRouterCatalog } from '@howicc/model-pricing'
import type { DiscoveredSession, ParseOptions, ProviderAdapter, SourceBundle } from '@howicc/parser-core'
import { buildClaudeSourceBundle } from './bundle'
import { buildClaudeCanonicalSession } from './canonical'
import { discoverClaudeSessions } from './discover'

const PARSER_VERSION = 'claude-code-adapter-v0'

export const ClaudeCodeAdapter: ProviderAdapter = {
  provider: 'claude_code',
  async discoverSessions(): Promise<DiscoveredSession[]> {
    return discoverClaudeSessions()
  },
  async buildSourceBundle(session: DiscoveredSession): Promise<SourceBundle> {
    return buildClaudeSourceBundle(session)
  },
  async parseCanonicalSession(bundle: SourceBundle, options?: ParseOptions): Promise<CanonicalSession> {
    const discoveredSession: DiscoveredSession = {
      provider: 'claude_code',
      sessionId: bundle.sessionId,
      projectKey: bundle.projectKey,
      projectPath: bundle.projectPath,
      transcriptPath: bundle.manifest.transcript.absolutePath,
      updatedAt: bundle.capturedAt,
      sizeBytes: bundle.files.find(file => file.kind === 'transcript')?.bytes ?? 0,
      firstPromptPreview: undefined,
      gitBranch: bundle.manifest.gitBranch,
      slug: bundle.manifest.slug,
    }

    return buildClaudeCanonicalSession({
      bundle,
      session: discoveredSession,
      parserVersion: PARSER_VERSION,
      pricingCatalog: options?.pricingCatalog as OpenRouterCatalog | undefined,
    })
  },
}
