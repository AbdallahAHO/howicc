import chalk from 'chalk'
import ora from 'ora'
import type { SessionDigest } from '@howicc/canonical'
import { extractSessionDigest } from '@howicc/profile'
import type { DiscoveredSession } from '@howicc/parser-core'
import { ClaudeCodeAdapter } from '@howicc/provider-claude-code'
import { CliConfigStore } from '../config/store'
import {
  buildDiscoveredSessionKey,
  buildSessionSourceRevisionHashIndex,
  getPricingCatalog,
} from '../lib/claude'
import { printDivider, printHint, printTitle } from '../lib/output'
import {
  formatDuration,
  formatLocalSessionSyncLabel,
  formatProjectDisplayPath,
  formatShortSessionId,
  getLocalSessionSyncStatus,
  getSessionRepositoryLabel,
  getSessionStatLabels,
  getSessionTitle,
} from '../lib/session-display'

type ListCommandOptions = {
  all?: boolean
  limit?: number
  synced?: boolean
  unsynced?: boolean
}

type ListedSession = {
  session: DiscoveredSession
  digest: SessionDigest
  sourceRevisionHash?: string
}

export const listCommand = async (options: ListCommandOptions = {}) => {
  const store = new CliConfigStore()
  const spinner = ora('Scanning local Claude Code sessions...').start()
  const sessions = await ClaudeCodeAdapter.discoverSessions()

  spinner.text = 'Computing local revision hashes...'
  const revisionHashIndex = await buildSessionSourceRevisionHashIndex(sessions)
  const filteredSessions = filterSessionsBySyncState(sessions, store, revisionHashIndex, options)
  const limit = options.all ? filteredSessions.length : options.limit && options.limit > 0 ? options.limit : 8
  const sessionsToDisplay = filteredSessions.slice(0, limit)

  if (sessions.length === 0) {
    spinner.stop()
    printTitle('Local Sessions')
    printHint('No Claude Code sessions were found on this machine.')
    printHint('Run `howicc sync --help` once you have local Claude activity to upload.')
    console.log()
    return
  }

  if (filteredSessions.length === 0) {
    spinner.stop()
    printTitle('Local Sessions')
    printHint('No sessions matched the selected filter.')
    printHint('Try `howicc list --all` or remove the sync-state filter.')
    console.log()
    return
  }

  const pricingCatalog = await getPricingCatalog()
  spinner.text = `Parsing ${sessionsToDisplay.length} session${sessionsToDisplay.length === 1 ? '' : 's'}...`
  const listedSessions = await Promise.all(
    sessionsToDisplay.map(async session => {
      const result = await extractDigest(session, pricingCatalog)

      return {
        session,
        digest: result.digest,
        sourceRevisionHash: result.sourceRevisionHash,
      }
    }),
  )
  spinner.stop()

  const syncCounts = countSessionsBySyncState(filteredSessions, store, revisionHashIndex)
  const groupedSessions = groupSessionsByProject(listedSessions)
  const summaryLabel =
    filteredSessions.length === sessions.length
      ? sessionsToDisplay.length === filteredSessions.length
        ? `Showing all ${sessionsToDisplay.length} discovered sessions`
        : `Showing ${sessionsToDisplay.length} of ${filteredSessions.length} discovered sessions`
      : sessionsToDisplay.length === filteredSessions.length
        ? `Showing all ${filteredSessions.length} matching sessions (${sessions.length} discovered total)`
        : `Showing ${sessionsToDisplay.length} of ${filteredSessions.length} matching sessions (${sessions.length} discovered total)`

  printTitle('Local Sessions')
  printHint(
    `${summaryLabel} · ${syncCounts.neverSynced} never synced · ${syncCounts.updatedSinceSync} updated locally · ${syncCounts.synced} already synced`,
  )

  if (!options.all && filteredSessions.length > sessionsToDisplay.length) {
    printHint(`Use \`howicc list --limit ${Math.min(filteredSessions.length, sessionsToDisplay.length + 8)}\` or \`howicc list --all\` for more.`)
  }

  console.log()

  for (const [projectLabel, entries] of groupedSessions.entries()) {
    console.log(`  ${chalk.bold(projectLabel)}`)
    printDivider()

    for (const { session, digest, sourceRevisionHash } of entries) {
      const syncState = store.getSessionRevisionSyncState({
        provider: session.provider,
        sessionId: session.sessionId,
        sourceRevisionHash,
      })
      const syncStatus = getLocalSessionSyncStatus(session, syncState)
      const statusIcon =
        syncStatus === 'synced'
          ? chalk.green('✓')
          : syncStatus === 'updated_since_sync'
            ? chalk.yellow('↻')
            : chalk.gray('•')

      const statusLabel =
        syncStatus === 'synced'
          ? chalk.green(formatLocalSessionSyncLabel(session, syncState))
          : syncStatus === 'updated_since_sync'
            ? chalk.yellow(formatLocalSessionSyncLabel(session, syncState))
            : chalk.dim(formatLocalSessionSyncLabel(session, syncState))

      const title = getSessionTitle({ session, digest })
      const repositoryLabel = getSessionRepositoryLabel({ session, digest })
      const meta = [
        formatShortSessionId(session.sessionId),
        digest.gitBranch ?? session.gitBranch,
        repositoryLabel !== projectLabel ? repositoryLabel : null,
        digest.durationMs ? formatDuration(digest.durationMs) : null,
        digest.turnCount > 0 ? `${digest.turnCount} turns` : null,
        `${new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${new Date(session.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      ].filter(Boolean).join(chalk.dim(' · '))

      const statLabels = getSessionStatLabels(digest)

      console.log(`  ${statusIcon} ${chalk.white(title)}`)
      console.log(`    ${chalk.dim(meta)}`)

      if (statLabels.length > 0) {
        console.log(`    ${chalk.dim(statLabels.join(' · '))}`)
      }

      console.log(`    ${statusLabel}`)
      console.log()
    }
  }
}

const filterSessionsBySyncState = (
  sessions: DiscoveredSession[],
  store: CliConfigStore,
  revisionHashIndex: Map<string, string | undefined>,
  options: Pick<ListCommandOptions, 'synced' | 'unsynced'>,
) => {
  const sortedSessions = [...sessions].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )

  if (!options.synced && !options.unsynced) {
    return sortedSessions
  }

  return sortedSessions.filter(session => {
    const syncStatus = getLocalSessionSyncStatus(
      session,
      store.getSessionRevisionSyncState({
        provider: session.provider,
        sessionId: session.sessionId,
        sourceRevisionHash: revisionHashIndex.get(buildDiscoveredSessionKey(session)),
      }),
    )

    if (options.synced && !options.unsynced) {
      return syncStatus === 'synced'
    }

    if (options.unsynced && !options.synced) {
      return syncStatus !== 'synced'
    }

    return true
  })
}

const groupSessionsByProject = (sessions: ListedSession[]) => {
  const groups = new Map<string, ListedSession[]>()

  for (const entry of sessions) {
    const projectLabel = formatProjectDisplayPath(
      entry.session.projectPath ?? entry.session.projectKey,
    )
    const currentEntries = groups.get(projectLabel) ?? []
    currentEntries.push(entry)
    groups.set(projectLabel, currentEntries)
  }

  return groups
}

const countSessionsBySyncState = (
  sessions: DiscoveredSession[],
  store: CliConfigStore,
  revisionHashIndex: Map<string, string | undefined>,
) => {
  let synced = 0
  let updatedSinceSync = 0
  let neverSynced = 0

  for (const session of sessions) {
    const status = getLocalSessionSyncStatus(
      session,
      store.getSessionRevisionSyncState({
        provider: session.provider,
        sessionId: session.sessionId,
        sourceRevisionHash: revisionHashIndex.get(buildDiscoveredSessionKey(session)),
      }),
    )

    if (status === 'synced') synced += 1
    else if (status === 'updated_since_sync') updatedSinceSync += 1
    else neverSynced += 1
  }

  return { synced, updatedSinceSync, neverSynced }
}

const extractDigest = async (
  session: DiscoveredSession,
  pricingCatalog: Awaited<ReturnType<typeof getPricingCatalog>>,
): Promise<{ digest: SessionDigest; sourceRevisionHash?: string }> => {
  try {
    const bundle = await ClaudeCodeAdapter.buildSourceBundle(session)
    const canonical = await ClaudeCodeAdapter.parseCanonicalSession(bundle, { pricingCatalog })
    return {
      digest: extractSessionDigest(canonical),
      sourceRevisionHash: canonical.source.sourceRevisionHash,
    }
  } catch {
    return {
      digest: {
        sessionId: session.sessionId,
        provider: session.provider,
        projectKey: session.projectKey,
        projectPath: session.projectPath,
        gitBranch: session.gitBranch,
        title: session.firstPromptPreview,
        createdAt: session.createdAt ?? session.updatedAt,
        updatedAt: session.updatedAt,
        turnCount: 0,
        messageCount: 0,
        toolRunCount: 0,
        toolCategories: { read: 0, write: 0, search: 0, command: 0, agent: 0, mcp: 0, plan: 0, question: 0, task: 0, web: 0, other: 0 },
        errorCount: 0,
        apiErrorCount: 0,
        apiErrorTypes: {},
        rejectionCount: 0,
        interruptionCount: 0,
        compactionCount: 0,
        subagentCount: 0,
        hasPlan: false,
        hasThinking: false,
        models: [],
        hourOfDay: 0,
        dayOfWeek: 0,
        sessionType: 'mixed',
        filesChanged: [],
        filesRead: [],
        languages: {},
        fileIterationDepth: 0,
        gitCommits: 0,
        gitPushes: 0,
        prLinks: [],
        mcpServersConfigured: [],
        mcpServersUsed: [],
        skillsTriggered: [],
      },
    }
  }
}
