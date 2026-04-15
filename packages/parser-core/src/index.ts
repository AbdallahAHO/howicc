import { createHash } from 'node:crypto'
import type { AgentThread, CanonicalEvent, CanonicalSession } from '@howicc/canonical'
import type { ProviderId } from '@howicc/canonical'

export type SourceFileKind =
  | 'transcript'
  | 'tool_result'
  | 'plan_file'
  | 'recovered_plan'
  | 'subagent_transcript'
  | 'subagent_meta'
  | 'remote_agent_meta'

export type SourceFile = {
  id: string
  relPath: string
  absolutePath: string
  kind: SourceFileKind
  sha256: string
  bytes: number
  mimeType?: string
}

export type SourceBundleManifest = {
  transcript: {
    relPath: string
    absolutePath: string
  }
  slug?: string
  cwd?: string
  gitBranch?: string
  planFiles: Array<{
    relPath: string
    absolutePath: string
    agentId?: string
  }>
  toolResults: Array<{
    relPath: string
    absolutePath: string
  }>
  subagents: Array<{
    agentId: string
    transcriptRelPath: string
    transcriptAbsolutePath: string
    metaRelPath?: string
    metaAbsolutePath?: string
    agentType?: string
    description?: string
  }>
  remoteAgents: Array<{
    relPath: string
    absolutePath: string
  }>
  warnings: string[]
}

export type SourceBundle = {
  kind: 'agent_source_bundle'
  version: 1
  provider: ProviderId
  sessionId: string
  projectKey: string
  projectPath?: string
  capturedAt: string
  files: SourceFile[]
  manifest: SourceBundleManifest
}

export type DiscoveredSession = {
  provider: ProviderId
  sessionId: string
  projectKey: string
  projectPath?: string
  transcriptPath: string
  createdAt?: string
  updatedAt: string
  sizeBytes: number
  firstPromptPreview?: string
  gitBranch?: string
  slug?: string
}

export type ArtifactExtractor<TArtifact> = {
  name: string
  extract(input: {
    bundle: SourceBundle
    events: CanonicalEvent[]
    agents: AgentThread[]
  }): Promise<TArtifact[]>
}

export type ParseOptions = {
  pricingCatalog?: unknown
}

export type ProviderAdapter = {
  provider: ProviderId
  discoverSessions(): Promise<DiscoveredSession[]>
  buildSourceBundle(session: DiscoveredSession): Promise<SourceBundle>
  parseCanonicalSession(bundle: SourceBundle, options?: ParseOptions): Promise<CanonicalSession>
}

export const createSourceRevisionHash = (parts: string[]): string =>
  createHash('sha256').update(parts.join('\n')).digest('hex')

export const createSourceRevisionHashFromFiles = (
  files: Array<Pick<SourceFile, 'relPath' | 'sha256'>>,
): string =>
  createSourceRevisionHash(
    [...files]
      .sort((left, right) => left.relPath.localeCompare(right.relPath))
      .map(file => `${file.relPath}:${file.sha256}`),
  )
