import type { AgentThread } from './agent-thread'
import type { SessionArtifact } from './artifact'
import type { AssetRef } from './asset'
import type { CanonicalEvent } from './event'
import type { ProviderId } from './provider'

export type CanonicalSource = {
  sessionId: string
  projectKey: string
  projectPath?: string
  sourceRevisionHash: string
  transcriptSha256: string
  importedAt: string
}

export type CanonicalMetadata = {
  title?: string
  customTitle?: string
  summary?: string
  tag?: string
  cwd?: string
  gitBranch?: string
  createdAt: string
  updatedAt: string
  mode?: string
}

export type CanonicalSelection = {
  strategy: 'latest_leaf'
  selectedLeafUuid?: string
  branchCount: number
}

export type CanonicalStats = {
  visibleMessageCount: number
  toolRunCount: number
  artifactCount: number
  subagentCount: number
}

export type CanonicalSession = {
  kind: 'canonical_session'
  schemaVersion: 1
  parserVersion: string
  provider: ProviderId
  source: CanonicalSource
  metadata: CanonicalMetadata
  selection: CanonicalSelection
  stats: CanonicalStats
  events: CanonicalEvent[]
  agents: AgentThread[]
  assets: AssetRef[]
  artifacts: SessionArtifact[]
  searchText: string
  providerData?: Record<string, unknown>
}
