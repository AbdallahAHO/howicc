import { createHash } from 'node:crypto'
import type { OpenRouterCatalog } from '@howicc/model-pricing'
import { gzipJson } from '@howicc/storage/compression'
import type { DiscoveredSession } from '@howicc/parser-core'
import type { CliSessionRevisionSyncState } from '../types'
import { buildCanonicalFromSession } from './claude'
import type { CliPrivacyPreflight } from './privacy'
import { inspectSessionPrivacy } from './privacy'
import { getLocalSessionSyncStatus } from './session-display'
import { buildSourceBundleArchive } from './source-bundle-archive'

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
  privacy: CliPrivacyPreflight
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
  options?: { pricingCatalog?: OpenRouterCatalog },
): Promise<PreparedSessionSync> => {
  const inspectedSession = await buildCanonicalFromSession(session, {
    pricingCatalog: options?.pricingCatalog,
  })

  if (!inspectedSession) {
    throw new Error(`Session ${session.sessionId} was not found in local Claude storage.`)
  }

  const privacy = await inspectSessionPrivacy({
    bundle: inspectedSession.bundle,
    render: inspectedSession.render,
  })

  return {
    session,
    sourceRevisionHash: inspectedSession.canonical.source.sourceRevisionHash,
    sourceApp: inspectedSession.canonical.provider,
    sourceSessionId: inspectedSession.canonical.source.sessionId,
    sourceProjectKey: inspectedSession.canonical.source.projectKey,
    title: inspectedSession.render.session.title,
    privacy,
    assets: [
      createPreparedAsset(
        'source_bundle',
        await buildSourceBundleArchive(inspectedSession.bundle),
      ),
      createPreparedAsset('canonical_json', gzipJson(inspectedSession.canonical)),
      createPreparedAsset('render_json', gzipJson(inspectedSession.render)),
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
