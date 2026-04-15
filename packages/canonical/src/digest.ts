import type { ProviderId } from './provider'
import type { ToolCategory } from './tool-category'

export type SessionDigestModelUsage = {
  model: string
  inputTokens: number
  outputTokens: number
}

export type SessionDigestMcpServer = {
  server: string
  toolCallCount: number
}

export type SessionDigestSkill = {
  name: string
  invocationCount: number
}

export type SessionDigestCommand = {
  name: string
  invocationCount: number
}

export type SessionDigestPrLink = {
  url: string
  number: number
  repository: string
}

export type SessionDigestRepository = {
  owner: string
  name: string
  fullName: string
  source: 'git_remote' | 'pr_link' | 'cwd_derived'
}

export type SessionType =
  | 'building'
  | 'debugging'
  | 'exploring'
  | 'investigating'
  | 'mixed'

export const emptySessionTypeDistribution = (): Record<SessionType, number> => ({
  building: 0,
  debugging: 0,
  exploring: 0,
  investigating: 0,
  mixed: 0,
})

export type SessionDigest = {
  sessionId: string
  provider: ProviderId
  agentVersion?: string
  projectKey: string
  projectPath?: string
  gitBranch?: string
  title?: string
  createdAt: string
  updatedAt: string
  durationMs?: number
  dayOfWeek: number
  turnCount: number
  messageCount: number
  toolRunCount: number
  toolCategories: Record<ToolCategory, number>
  errorCount: number
  apiErrorCount: number
  apiErrorTypes: Record<string, number>
  rejectionCount: number
  interruptionCount: number
  compactionCount: number
  subagentCount: number
  hasPlan: boolean
  hasThinking: boolean
  models: SessionDigestModelUsage[]
  estimatedCostUsd?: number
  hourOfDay: number
  // Session classification — derived from tool category ratios
  sessionType: SessionType
  // Changeset signals — extracted from Edit/Write/Read tool inputs
  filesChanged: string[]
  filesRead: string[]
  languages: Record<string, number>
  fileIterationDepth: number
  timeToFirstEditMs?: number
  gitCommits: number
  gitPushes: number
  repository?: SessionDigestRepository
  prLinks: SessionDigestPrLink[]
  mcpServersConfigured: string[]
  mcpServersUsed: SessionDigestMcpServer[]
  skillsTriggered: SessionDigestSkill[]
  commandsInvoked: SessionDigestCommand[]
  providerDigest?: Record<string, unknown>
}
