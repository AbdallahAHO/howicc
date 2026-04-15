import type {
  SessionDigest,
  SessionDigestRepository,
  ToolCategory,
  UserProfile,
  UserProfileCost,
  UserProfileIntegrations,
  UserProfileModel,
  UserProfileProductivity,
  UserProfileProject,
  UserProfileProvider,
  UserProfileToolcraft,
} from '@howicc/canonical'
import { emptyToolCategories, emptySessionTypeDistribution } from '@howicc/canonical'

/**
 * Build a UserProfile by aggregating all SessionDigests for a user.
 * Pure computation — no I/O, no side effects.
 */
export const buildUserProfile = (
  userId: string,
  digests: SessionDigest[],
): UserProfile => {
  const sorted = [...digests].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const n = sorted.length

  const hourlyDistribution = new Array(24).fill(0) as number[]
  const weekdayDistribution = new Array(7).fill(0) as number[] // 0=Sun, 6=Sat
  const activeDates = new Set<string>()

  let totalDurationMs = 0
  let totalTurns = 0
  let totalToolRuns = 0
  let totalErrors = 0
  let totalRejections = 0
  let totalInterruptions = 0
  let totalCompactions = 0
  let sessionsWithPlan = 0
  let sessionsWithAgents = 0
  let sessionsWithThinking = 0

  // Productivity accumulators
  const allFilesChanged = new Set<string>()
  const allFilesRead = new Set<string>()
  const globalLanguages: Record<string, number> = {}
  const fileSessionCounts = new Map<string, number>()
  const prRepoMap = new Map<string, number>()
  const sessionTypeCounts = emptySessionTypeDistribution()
  let totalApiErrors = 0
  const globalApiErrorTypes: Record<string, number> = {}
  let totalGitCommits = 0
  let totalGitPushes = 0
  let totalPrLinks = 0
  let totalFilesChangedCount = 0
  let totalFilesReadCount = 0
  let totalFileIterationDepth = 0
  let fileIterationDepthCount = 0
  let totalTimeToFirstEdit = 0
  let timeToFirstEditCount = 0

  const categories = emptyToolCategories()

  const projectMap = new Map<string, {
    projectPath?: string
    repository?: {
      fullName: string
      source: SessionDigestRepository['source']
    }
    sessionCount: number
    totalDurationMs: number
    estimatedCostUsd: number
    lastActiveAt: string
    languages: Record<string, number>
    branches: Set<string>
  }>()

  const modelMap = new Map<string, {
    sessionCount: number
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
  }>()

  const providerMap = new Map<string, {
    sessionCount: number
    totalDurationMs: number
    estimatedCostUsd: number
    versions: Map<string, number>
  }>()

  const dailyMap = new Map<string, { sessionCount: number; totalDurationMs: number }>()

  const costByMonth = new Map<string, { totalUsd: number; sessionCount: number }>()

  const mcpConfiguredMap = new Map<string, number>()
  const mcpUsedMap = new Map<string, { sessionCount: number; totalCalls: number }>()
  const skillMap = new Map<string, { sessionCount: number; totalInvocations: number }>()
  const commandMap = new Map<string, { sessionCount: number; totalInvocations: number }>()

  // CC-specific accumulators
  let ccSessions = 0
  let ccTotalTurns = 0
  let ccCacheHitSum = 0
  let ccCacheHitCount = 0

  for (const d of sorted) {
    totalDurationMs += d.durationMs ?? 0
    totalTurns += d.turnCount
    totalToolRuns += d.toolRunCount
    totalErrors += d.errorCount
    totalRejections += d.rejectionCount
    totalInterruptions += d.interruptionCount
    if (d.hasPlan) sessionsWithPlan += 1
    if (d.subagentCount > 0) sessionsWithAgents += 1
    if (d.hasThinking) sessionsWithThinking += 1
    totalCompactions += d.compactionCount

    hourlyDistribution[d.hourOfDay]! += 1
    weekdayDistribution[d.dayOfWeek]! += 1

    const dateKey = d.createdAt.slice(0, 10)
    activeDates.add(dateKey)
    const dayEntry = dailyMap.get(dateKey) ?? { sessionCount: 0, totalDurationMs: 0 }
    dayEntry.sessionCount += 1
    dayEntry.totalDurationMs += d.durationMs ?? 0
    dailyMap.set(dateKey, dayEntry)

    for (const [cat, count] of Object.entries(d.toolCategories)) {
      categories[cat as ToolCategory] += count
    }

    // Productivity
    for (const f of d.filesChanged) {
      allFilesChanged.add(f)
      const basename = f.split('/').pop() ?? f
      fileSessionCounts.set(basename, (fileSessionCounts.get(basename) ?? 0) + 1)
    }
    for (const f of d.filesRead) allFilesRead.add(f)
    totalFilesChangedCount += d.filesChanged.length
    totalFilesReadCount += d.filesRead.length
    totalGitCommits += d.gitCommits
    totalGitPushes += d.gitPushes
    for (const [lang, count] of Object.entries(d.languages)) {
      globalLanguages[lang] = (globalLanguages[lang] ?? 0) + count
    }
    for (const pr of d.prLinks) {
      totalPrLinks += 1
      prRepoMap.set(pr.repository, (prRepoMap.get(pr.repository) ?? 0) + 1)
    }
    sessionTypeCounts[d.sessionType] = (sessionTypeCounts[d.sessionType] ?? 0) + 1
    if (d.fileIterationDepth > 0) {
      totalFileIterationDepth += d.fileIterationDepth
      fileIterationDepthCount += 1
    }
    if (d.timeToFirstEditMs != null) {
      totalTimeToFirstEdit += d.timeToFirstEditMs
      timeToFirstEditCount += 1
    }

    // Projects
    const proj = projectMap.get(d.projectKey) ?? {
      projectPath: d.projectPath,
      repository: undefined as
        | {
            fullName: string
            source: SessionDigestRepository['source']
          }
        | undefined,
      sessionCount: 0,
      totalDurationMs: 0,
      estimatedCostUsd: 0,
      lastActiveAt: d.updatedAt,
      languages: {} as Record<string, number>,
      branches: new Set<string>(),
    }
    // Use the highest-confidence repository source
    if (d.repository && (!proj.repository || repoSourcePriority(d.repository.source) > repoSourcePriority(proj.repository.source))) {
      proj.repository = { fullName: d.repository.fullName, source: d.repository.source }
    }
    proj.sessionCount += 1
    proj.totalDurationMs += d.durationMs ?? 0
    proj.estimatedCostUsd += d.estimatedCostUsd ?? 0
    if (d.updatedAt > proj.lastActiveAt) proj.lastActiveAt = d.updatedAt
    for (const [lang, count] of Object.entries(d.languages)) {
      proj.languages[lang] = (proj.languages[lang] ?? 0) + count
    }
    if (d.gitBranch) proj.branches.add(d.gitBranch)
    projectMap.set(d.projectKey, proj)

    // Models
    const sessionModels = new Set<string>()
    for (const m of d.models) {
      sessionModels.add(m.model)
      const existing = modelMap.get(m.model) ?? {
        sessionCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      }
      existing.inputTokens += m.inputTokens
      existing.outputTokens += m.outputTokens
      modelMap.set(m.model, existing)
    }
    for (const model of sessionModels) {
      modelMap.get(model)!.sessionCount += 1
    }

    // Proportional cost attribution to models
    if (d.estimatedCostUsd != null && d.estimatedCostUsd > 0) {
      const totalSessionTokens = d.models.reduce(
        (sum, m) => sum + m.inputTokens + m.outputTokens,
        0,
      )
      for (const m of d.models) {
        const share =
          totalSessionTokens > 0 ? (m.inputTokens + m.outputTokens) / totalSessionTokens : 0
        const existing = modelMap.get(m.model)
        if (existing) {
          existing.estimatedCostUsd += d.estimatedCostUsd * share
        }
      }
    }

    // API errors
    totalApiErrors += d.apiErrorCount
    for (const [errType, count] of Object.entries(d.apiErrorTypes)) {
      globalApiErrorTypes[errType] = (globalApiErrorTypes[errType] ?? 0) + count
    }

    // Providers
    const prov = providerMap.get(d.provider) ?? {
      sessionCount: 0,
      totalDurationMs: 0,
      estimatedCostUsd: 0,
      versions: new Map<string, number>(),
    }
    prov.sessionCount += 1
    prov.totalDurationMs += d.durationMs ?? 0
    prov.estimatedCostUsd += d.estimatedCostUsd ?? 0
    if (d.agentVersion) {
      prov.versions.set(d.agentVersion, (prov.versions.get(d.agentVersion) ?? 0) + 1)
    }
    providerMap.set(d.provider, prov)

    // Cost by month
    const month = d.createdAt.slice(0, 7)
    const monthEntry = costByMonth.get(month) ?? { totalUsd: 0, sessionCount: 0 }
    monthEntry.totalUsd += d.estimatedCostUsd ?? 0
    monthEntry.sessionCount += 1
    costByMonth.set(month, monthEntry)

    // MCP servers
    for (const server of d.mcpServersConfigured) {
      mcpConfiguredMap.set(server, (mcpConfiguredMap.get(server) ?? 0) + 1)
    }
    const usedServersInSession = new Set<string>()
    for (const { server, toolCallCount } of d.mcpServersUsed) {
      usedServersInSession.add(server)
      const existing = mcpUsedMap.get(server) ?? { sessionCount: 0, totalCalls: 0 }
      existing.totalCalls += toolCallCount
      mcpUsedMap.set(server, existing)
    }
    for (const server of usedServersInSession) {
      mcpUsedMap.get(server)!.sessionCount += 1
    }

    // Skills
    const skillsInSession = new Set<string>()
    for (const { name, invocationCount } of d.skillsTriggered) {
      skillsInSession.add(name)
      const existing = skillMap.get(name) ?? { sessionCount: 0, totalInvocations: 0 }
      existing.totalInvocations += invocationCount
      skillMap.set(name, existing)
    }
    for (const name of skillsInSession) {
      skillMap.get(name)!.sessionCount += 1
    }

    const commandsInSession = new Set<string>()
    for (const { name, invocationCount } of d.commandsInvoked) {
      commandsInSession.add(name)
      const existing = commandMap.get(name) ?? { sessionCount: 0, totalInvocations: 0 }
      existing.totalInvocations += invocationCount
      commandMap.set(name, existing)
    }
    for (const name of commandsInSession) {
      commandMap.get(name)!.sessionCount += 1
    }

    // CC-specific
    if (d.provider === 'claude_code') {
      ccSessions += 1
      ccTotalTurns += d.turnCount
      const ccDigest = d.providerDigest as { cacheHitRate?: number } | undefined
      if (ccDigest?.cacheHitRate != null) {
        ccCacheHitSum += ccDigest.cacheHitRate
        ccCacheHitCount += 1
      }
    }
  }

  const { currentStreak, longestStreak } = computeStreaks(activeDates)
  const totalCost = sorted.reduce((sum, d) => sum + (d.estimatedCostUsd ?? 0), 0)

  // Build all server names from both configured and used
  const allMcpServers = new Set([...mcpConfiguredMap.keys(), ...mcpUsedMap.keys()])
  const topCommands = [...commandMap.entries()]
    .map(([name, command]) => ({ name, ...command }))
    .sort((left, right) => {
      if (right.totalInvocations !== left.totalInvocations) {
        return right.totalInvocations - left.totalInvocations
      }

      return left.name.localeCompare(right.name)
    })

  const toolcraft: UserProfileToolcraft = {
    totalToolRuns,
    categoryBreakdown: categories,
    errorRate: totalToolRuns > 0 ? totalErrors / totalToolRuns : 0,
    apiErrorCount: totalApiErrors,
    apiErrorTypes: globalApiErrorTypes,
    rejectionRate: totalToolRuns > 0 ? totalRejections / totalToolRuns : 0,
    interruptionRate: n > 0 ? totalInterruptions / n : 0,
    compactionRate: n > 0 ? totalCompactions / n : 0,
    planUsageRate: n > 0 ? sessionsWithPlan / n : 0,
    agentUsageRate: n > 0 ? sessionsWithAgents / n : 0,
    thinkingVisibleRate: n > 0 ? sessionsWithThinking / n : 0,
    topCommands,
  }

  const projects: UserProfileProject[] = [...projectMap.entries()]
    .map(([key, p]) => ({
      projectKey: key,
      projectPath: p.projectPath,
      displayName: p.repository?.fullName ?? deriveProjectName(p.projectPath ?? key),
      repository: p.repository,
      sessionCount: p.sessionCount,
      totalDurationMs: p.totalDurationMs,
      estimatedCostUsd: p.estimatedCostUsd,
      lastActiveAt: p.lastActiveAt,
      languages: p.languages,
      branches: [...p.branches],
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  const topLanguages = Object.entries(globalLanguages)
    .sort((a, b) => b[1] - a[1])
    .map(([language, fileCount]) => ({ language, fileCount }))

  const topEditedFiles = [...fileSessionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, sessionCount]) => ({ file, sessionCount }))

  const prRepositories = [...prRepoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([repository, prCount]) => ({ repository, prCount }))

  const productivity: UserProfileProductivity = {
    totalFilesChanged: totalFilesChangedCount,
    totalFilesRead: totalFilesReadCount,
    uniqueFilesChanged: allFilesChanged.size,
    uniqueFilesRead: allFilesRead.size,
    totalGitCommits,
    totalGitPushes,
    totalPrLinks,
    prRepositories,
    languages: globalLanguages,
    topLanguages,
    topEditedFiles,
    averageFilesChangedPerSession: n > 0 ? totalFilesChangedCount / n : 0,
    averageFileIterationDepth: fileIterationDepthCount > 0 ? totalFileIterationDepth / fileIterationDepthCount : 0,
    averageTimeToFirstEditMs: timeToFirstEditCount > 0 ? totalTimeToFirstEdit / timeToFirstEditCount : undefined,
    sessionTypeDistribution: sessionTypeCounts,
  }

  const models: UserProfileModel[] = [...modelMap.entries()]
    .map(([model, m]) => ({ model, ...m }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  const cost: UserProfileCost = {
    totalUsd: totalCost,
    averagePerSessionUsd: n > 0 ? totalCost / n : 0,
    byMonth: [...costByMonth.entries()]
      .map(([month, entry]) => ({ month, ...entry }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  }

  const integrations: UserProfileIntegrations = {
    mcpServers: [...allMcpServers]
      .map(server => ({
        server,
        configuredCount: mcpConfiguredMap.get(server) ?? 0,
        usedCount: mcpUsedMap.get(server)?.sessionCount ?? 0,
        totalToolCalls: mcpUsedMap.get(server)?.totalCalls ?? 0,
      }))
      .sort((a, b) => b.configuredCount + b.usedCount - (a.configuredCount + a.usedCount)),
    skills: [...skillMap.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.sessionCount - a.sessionCount),
  }

  const providers: UserProfileProvider[] = [...providerMap.entries()]
    .map(([provider, p]) => ({
      provider: provider as SessionDigest['provider'],
      sessionCount: p.sessionCount,
      totalDurationMs: p.totalDurationMs,
      estimatedCostUsd: p.estimatedCostUsd,
      versions: [...p.versions.entries()]
        .map(([version, sessionCount]) => ({ version, sessionCount }))
        .sort((a, b) => b.sessionCount - a.sessionCount),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  return {
    userId,
    generatedAt: new Date().toISOString(),
    digestCount: n,
    activity: {
      totalSessions: n,
      totalDurationMs,
      activeDays: activeDates.size,
      currentStreak,
      longestStreak,
      averageSessionDurationMs: n > 0 ? totalDurationMs / n : 0,
      averageTurnsPerSession: n > 0 ? totalTurns / n : 0,
      hourlyDistribution,
      weekdayDistribution,
      dailyActivity: [...dailyMap.entries()]
        .map(([date, entry]) => ({ date, ...entry }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      firstSessionAt: sorted[0]?.createdAt,
      lastSessionAt: sorted[n - 1]?.updatedAt,
    },
    projects,
    productivity,
    toolcraft,
    models,
    cost,
    integrations,
    providers,
    providerProfiles:
      ccSessions > 0
        ? {
            claudeCode: {
              cacheHitRate: ccCacheHitCount > 0 ? ccCacheHitSum / ccCacheHitCount : undefined,
              thinkingVisibleRate: ccSessions > 0 ? sessionsWithThinking / ccSessions : 0,
              avgTurnsPerSession: ccSessions > 0 ? ccTotalTurns / ccSessions : 0,
            },
          }
        : undefined,
  }
}

const computeStreaks = (activeDates: Set<string>): { currentStreak: number; longestStreak: number } => {
  if (activeDates.size === 0) return { currentStreak: 0, longestStreak: 0 }

  const sortedDates = [...activeDates].sort()

  let longestStreak = 1
  let tempStreak = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]!)
    const curr = new Date(sortedDates[i]!)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)

    if (diffDays === 1) {
      tempStreak += 1
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak)

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  let currentStreak = 0
  if (activeDates.has(today) || activeDates.has(yesterday)) {
    let checkDate = activeDates.has(today) ? today : yesterday
    while (activeDates.has(checkDate)) {
      currentStreak += 1
      const d = new Date(checkDate)
      d.setDate(d.getDate() - 1)
      checkDate = d.toISOString().slice(0, 10)
    }
  }

  return { currentStreak, longestStreak }
}

const repoSourcePriority = (
  source: SessionDigestRepository['source'],
): number => {
  switch (source) {
    case 'pr_link': return 3
    case 'git_remote': return 2
    case 'cwd_derived': return 1
    default: return 0
  }
}

// Derive a readable project name from the full path
const deriveProjectName = (pathOrKey: string): string => {
  // Strip common home directory prefixes
  const cleaned = pathOrKey
    .replace(/^\/Users\/[^/]+\//, '')
    .replace(/^\/home\/[^/]+\//, '')
    .replace(/^-Users-[^-]+-/, '')
    .replace(/^Developer\//, '')
    .replace(/^dev\//, '')

  // Use last 2 meaningful path segments
  const segments = cleaned.split('/').filter(s => s && s !== '.' && s !== '-')
  if (segments.length === 0) return pathOrKey

  return segments.length <= 2
    ? segments.join('/')
    : segments.slice(-2).join('/')
}
