import type { ProviderId } from './provider'
import type { SessionType } from './digest'
import type { ToolCategory } from './tool-category'

export type UserProfileDailyActivity = {
  date: string
  sessionCount: number
  totalDurationMs: number
}

export type UserProfileActivity = {
  totalSessions: number
  totalDurationMs: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  averageSessionDurationMs: number
  averageTurnsPerSession: number
  hourlyDistribution: number[]
  weekdayDistribution: number[]
  dailyActivity: UserProfileDailyActivity[]
  firstSessionAt?: string
  lastSessionAt?: string
}

export type UserProfileProject = {
  projectKey: string
  projectPath?: string
  displayName: string
  repository?: {
    fullName: string
    source: 'git_remote' | 'pr_link' | 'cwd_derived'
  }
  sessionCount: number
  totalDurationMs: number
  estimatedCostUsd: number
  lastActiveAt: string
  languages: Record<string, number>
  branches: string[]
}

export type UserProfileToolcraft = {
  totalToolRuns: number
  categoryBreakdown: Record<ToolCategory, number>
  errorRate: number
  apiErrorCount: number
  apiErrorTypes: Record<string, number>
  rejectionRate: number
  interruptionRate: number
  compactionRate: number
  planUsageRate: number
  agentUsageRate: number
  thinkingVisibleRate: number
  topCommands: UserProfileCommand[]
}

export type UserProfileModel = {
  model: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export type UserProfileCost = {
  totalUsd: number
  averagePerSessionUsd: number
  byMonth: Array<{ month: string; totalUsd: number; sessionCount: number }>
}

export type UserProfileMcpServer = {
  server: string
  configuredCount: number
  usedCount: number
  totalToolCalls: number
}

export type UserProfileSkill = {
  name: string
  sessionCount: number
  totalInvocations: number
}

export type UserProfileCommand = {
  name: string
  sessionCount: number
  totalInvocations: number
}

export type UserProfileIntegrations = {
  mcpServers: UserProfileMcpServer[]
  skills: UserProfileSkill[]
}

export type UserProfileProvider = {
  provider: ProviderId
  sessionCount: number
  totalDurationMs: number
  estimatedCostUsd: number
  versions: Array<{ version: string; sessionCount: number }>
}

export type ClaudeCodeProviderProfile = {
  cacheHitRate?: number
  thinkingVisibleRate: number
  avgTurnsPerSession: number
}

export type UserProfileProductivity = {
  totalFilesChanged: number
  totalFilesRead: number
  uniqueFilesChanged: number
  uniqueFilesRead: number
  totalGitCommits: number
  totalGitPushes: number
  totalPrLinks: number
  prRepositories: Array<{ repository: string; prCount: number }>
  languages: Record<string, number>
  topLanguages: Array<{ language: string; fileCount: number }>
  topEditedFiles: Array<{ file: string; sessionCount: number }>
  averageFilesChangedPerSession: number
  averageFileIterationDepth: number
  averageTimeToFirstEditMs?: number
  sessionTypeDistribution: Record<SessionType, number>
}

export type UserProfile = {
  userId: string
  generatedAt: string
  digestCount: number
  activity: UserProfileActivity
  projects: UserProfileProject[]
  productivity: UserProfileProductivity
  toolcraft: UserProfileToolcraft
  models: UserProfileModel[]
  cost: UserProfileCost
  integrations: UserProfileIntegrations
  providers: UserProfileProvider[]
  providerProfiles?: {
    claudeCode?: ClaudeCodeProviderProfile
  }
}
