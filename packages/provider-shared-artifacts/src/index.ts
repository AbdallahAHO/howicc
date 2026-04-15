import type { AgentThread, CanonicalEvent, SessionArtifact } from '@howicc/canonical'
import type { SourceBundle } from '@howicc/parser-core'

export type SharedArtifactExtractionContext = {
  bundle: SourceBundle
  events: CanonicalEvent[]
  agents: AgentThread[]
}

export type SharedArtifactExtractor = {
  name: string
  extract(input: SharedArtifactExtractionContext): Promise<SessionArtifact[]>
}
