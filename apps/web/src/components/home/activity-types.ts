export type ActivityVisibility = 'private' | 'unlisted' | 'public'

export type ActivitySessionType =
  | 'building'
  | 'debugging'
  | 'exploring'
  | 'investigating'
  | 'mixed'

export type ActivityRepository = {
  fullName: string
  source: 'git_remote' | 'pr_link' | 'cwd_derived'
}

export type ActivityItem = {
  conversationId: string
  slug: string
  title: string
  visibility: ActivityVisibility
  provider: string
  projectKey: string
  projectPath?: string
  sessionCreatedAt: string
  syncedAt: string
  durationMs?: number
  estimatedCostUsd?: number
  toolRunCount: number
  turnCount: number
  messageCount: number
  sessionType: ActivitySessionType
  hasPlan: boolean
  models: string[]
  repository: ActivityRepository | null
}

export type StatsSnapshot = {
  digestCount: number
  totalSessions: number
  totalDurationMs: number
  totalCostUsd: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  firstSessionAt?: string
  lastSessionAt?: string
}
