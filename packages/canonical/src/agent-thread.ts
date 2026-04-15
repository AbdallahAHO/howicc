import type { SessionArtifact } from './artifact'
import type { AssetRef } from './asset'
import type { CanonicalEvent } from './event'

export type AgentThread = {
  agentId: string
  title?: string
  role: 'subagent' | 'remote_agent'
  events: CanonicalEvent[]
  assets?: AssetRef[]
  artifacts?: SessionArtifact[]
  metadata?: Record<string, unknown>
}
