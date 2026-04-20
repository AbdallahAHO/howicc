import { createHash } from 'node:crypto'
import type { OpenRouterCatalog } from '@howicc/model-pricing'
import { gzipJson } from '@howicc/storage/compression'
import type { DiscoveredSession } from '@howicc/parser-core'
import type { CliSessionRevisionSyncState } from '../types'
import { buildCanonicalFromSession } from './claude'
import {
  buildPrivacySafeUpload,
  type CliPreparedSessionPrivacy,
  type CliSyncPrivacyMode,
} from './privacy'
import { getLocalSessionSyncStatus } from './session-display'

export type PreparedSyncAsset = {
  kind: 'source_bundle' | 'canonical_json' | 'render_json'
  body: Uint8Array
  bytes: number
  sha256: string
  contentType: string
}

export type PreparedSessionSync = {
  session: DiscoveredSession
  sourceRevisionHash: string
  sourceApp: string
  sourceSessionId: string
  sourceProjectKey: string
  title: string
  privacy: CliPreparedSessionPrivacy
  assets: PreparedSyncAsset[]
}

export const selectSessionsForSync = (input: {
  sessions: DiscoveredSession[]
  sessionId?: string
  all?: boolean
  limit?: number
}) => {
  const sortedSessions = [...input.sessions].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )

  if (input.sessionId) {
    return sortedSessions.filter(session => session.sessionId === input.sessionId)
  }

  if (input.all) {
    return sortedSessions
  }

  const limit = input.limit && input.limit > 0 ? input.limit : 20
  return sortedSessions.slice(0, limit)
}

export const selectDefaultSessionsForSync = (input: {
  sessions: DiscoveredSession[]
  getSyncState?: (session: DiscoveredSession) => CliSessionRevisionSyncState | undefined
  limit?: number
}) => {
  const limit = input.limit && input.limit > 0 ? input.limit : 5
  const sortedSessions = selectSessionsForSync({ sessions: input.sessions, all: true })
  const pendingSessions = sortedSessions.filter(session => {
    const syncState = input.getSyncState?.(session)
    return getLocalSessionSyncStatus(session, syncState) !== 'synced'
  })

  return (pendingSessions.length > 0 ? pendingSessions : sortedSessions).slice(0, limit)
}

export const shouldSkipSessionSync = (input: {
  previousRevisionHash?: string
  nextRevisionHash: string
  force?: boolean
}) => {
  if (input.force) return false
  return input.previousRevisionHash === input.nextRevisionHash
}

export const prepareSessionSync = async (
  session: DiscoveredSession,
  options?: {
    pricingCatalog?: OpenRouterCatalog
    privacyMode?: CliSyncPrivacyMode
  },
): Promise<PreparedSessionSync> => {
  const inspectedSession = await buildCanonicalFromSession(session, {
    pricingCatalog: options?.pricingCatalog,
  })

  if (!inspectedSession) {
    throw new Error(`Session ${session.sessionId} was not found in local Claude storage.`)
  }

  const safeUpload = await buildPrivacySafeUpload({
    bundle: inspectedSession.bundle,
    canonical: inspectedSession.canonical,
    render: inspectedSession.render,
    mode: options?.privacyMode ?? 'sanitize',
  })

  return {
    session,
    sourceRevisionHash: inspectedSession.canonical.source.sourceRevisionHash,
    sourceApp: inspectedSession.canonical.provider,
    sourceSessionId: inspectedSession.canonical.source.sessionId,
    sourceProjectKey: inspectedSession.canonical.source.projectKey,
    title: safeUpload.render.session.title,
    privacy: safeUpload.privacy,
    assets: [
      createPreparedAsset(
        'source_bundle',
        safeUpload.sourceBundleArchive,
      ),
      createPreparedAsset('canonical_json', gzipJson(safeUpload.canonical)),
      createPreparedAsset('render_json', gzipJson(safeUpload.render)),
    ],
  }
}

const createPreparedAsset = (
  kind: PreparedSyncAsset['kind'],
  body: Uint8Array,
): PreparedSyncAsset => {
  return {
    kind,
    body,
    bytes: body.byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
    contentType: 'application/gzip',
  }
}
