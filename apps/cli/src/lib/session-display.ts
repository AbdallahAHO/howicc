import { homedir } from 'node:os'
import type { SessionDigest } from '@howicc/canonical'
import type { DiscoveredSession } from '@howicc/parser-core'
import type { CliSessionRevisionSyncState } from '../types'
import { formatRelativeTime } from './output'

const HOME_DIR = homedir()

export type LocalSessionSyncStatus =
  | 'never_synced'
  | 'updated_since_sync'
  | 'synced'

export const truncateText = (
  value: string,
  maxLength: number,
  ellipsis = '…',
): string => {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= ellipsis.length) {
    return ellipsis.slice(0, maxLength)
  }

  return `${value.slice(0, maxLength - ellipsis.length).trimEnd()}${ellipsis}`
}

export const formatProjectDisplayPath = (
  value: string | undefined,
  options: {
    maxHead?: number
    maxTail?: number
  } = {},
): string => {
  if (!value) {
    return 'Unknown project'
  }

  let normalized = value.replace(/\\/g, '/').replace(/\/\/+/g, '/')

  if (HOME_DIR && normalized.startsWith(HOME_DIR)) {
    normalized = `~${normalized.slice(HOME_DIR.length)}`
  }

  if (normalized.startsWith('~') && normalized !== '~' && !normalized.startsWith('~/')) {
    normalized = normalized.replace(/^~/, '~/')
  }

  const segments = splitPath(normalized)
  const maxHead = options.maxHead ?? 2
  const maxTail = options.maxTail ?? 2

  if (segments.length <= maxHead + maxTail) {
    return joinPathSegments(segments)
  }

  return joinPathSegments([
    ...segments.slice(0, maxHead),
    '...',
    ...segments.slice(-maxTail),
  ])
}

export const getLocalSessionSyncStatus = (
  session: Pick<DiscoveredSession, 'updatedAt'>,
  syncState?: CliSessionRevisionSyncState,
): LocalSessionSyncStatus => {
  if (!syncState?.latestSyncedRevision) {
    return 'never_synced'
  }

  if (syncState.currentSyncedRevision) {
    return 'synced'
  }

  if (!syncState.currentRevisionKnown) {
    const sessionUpdatedAt = Date.parse(session.updatedAt)
    const lastSyncedAt = Date.parse(syncState.latestSyncedRevision.syncedAt)

    if (!Number.isNaN(sessionUpdatedAt) && !Number.isNaN(lastSyncedAt)) {
      return sessionUpdatedAt <= lastSyncedAt ? 'synced' : 'updated_since_sync'
    }
  }

  return 'updated_since_sync'
}

export const formatLocalSessionSyncLabel = (
  session: Pick<DiscoveredSession, 'updatedAt'>,
  syncState?: CliSessionRevisionSyncState,
): string => {
  const status = getLocalSessionSyncStatus(session, syncState)

  if (status === 'never_synced') {
    return 'Not synced yet'
  }

  if (status === 'updated_since_sync') {
    return `Updated since last sync (${formatRelativeTime(session.updatedAt)})`
  }

  if (syncState?.currentSyncedRevision) {
    return `Synced ${formatRelativeTime(syncState.currentSyncedRevision.syncedAt)}`
  }

  return `Looks unchanged since last sync (${formatRelativeTime(syncState!.latestSyncedRevision!.syncedAt)})`
}

export const getSessionTitle = (input: {
  session: Pick<DiscoveredSession, 'sessionId' | 'firstPromptPreview'>
  digest?: Pick<SessionDigest, 'title'>
}): string => {
  const candidate =
    input.digest?.title?.trim() ??
    input.session.firstPromptPreview?.trim() ??
    input.session.sessionId

  return truncateText(candidate, 88)
}

export const getSessionRepositoryLabel = (input: {
  session: Pick<DiscoveredSession, 'projectKey' | 'projectPath'>
  digest?: Pick<SessionDigest, 'repository'>
}): string => {
  return (
    input.digest?.repository?.fullName ??
    formatProjectDisplayPath(input.session.projectPath ?? input.session.projectKey)
  )
}

export const getSessionStatLabels = (
  digest?: Pick<
    SessionDigest,
    | 'toolRunCount'
    | 'filesChanged'
    | 'languages'
    | 'gitCommits'
    | 'prLinks'
    | 'sessionType'
  >,
): string[] => {
  if (!digest) {
    return []
  }

  const labels: string[] = []

  if (digest.toolRunCount > 0) labels.push(`${digest.toolRunCount} tools`)
  if (digest.filesChanged.length > 0) labels.push(`${digest.filesChanged.length} files`)

  const topLanguages = Object.entries(digest.languages)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([language, count]) => `${language}(${count})`)

  if (topLanguages.length > 0) {
    labels.push(topLanguages.join(' '))
  }

  if (digest.gitCommits > 0) labels.push(`${digest.gitCommits} commits`)
  if (digest.prLinks.length > 0) labels.push(`PR #${digest.prLinks[0]!.number}`)
  if (digest.sessionType !== 'mixed' && digest.toolRunCount > 0) labels.push(digest.sessionType)

  return labels
}

export const formatShortSessionId = (sessionId: string): string =>
  sessionId.length <= 8 ? sessionId : sessionId.slice(0, 8)

export const formatDuration = (durationMs: number): string => {
  const totalMinutes = Math.round(durationMs / 60_000)

  if (totalMinutes < 60) {
    return `${Math.max(1, totalMinutes)}m`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

const splitPath = (value: string): string[] => {
  if (!value) return []

  if (value === '~') {
    return ['~']
  }

  let marker = ''
  let rest = value

  if (value.startsWith('~/')) {
    marker = '~'
    rest = value.slice(2)
  } else if (value.startsWith('~')) {
    marker = '~'
    rest = value.slice(1)
  } else if (value.startsWith('/')) {
    marker = '/'
    rest = value.slice(1)
  }

  const parts = rest ? rest.split('/').filter(Boolean) : []
  return marker ? [marker, ...parts] : parts
}

const joinPathSegments = (segments: string[]): string => {
  if (segments.length === 0) {
    return ''
  }

  if (segments[0] === '~') {
    return segments.length === 1 ? '~' : `~/${segments.slice(1).join('/')}`
  }

  if (segments[0] === '/') {
    const remainder = segments.slice(1).join('/')
    return remainder ? `/${remainder}` : '/'
  }

  return segments.join('/')
}
