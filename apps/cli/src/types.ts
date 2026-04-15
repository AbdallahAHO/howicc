import type { ProviderId } from '@howicc/canonical'

export type CliSyncedRevision = {
  provider: ProviderId
  sessionId: string
  conversationId: string
  revisionId: string
  sourceRevisionHash: string
  syncedAt: string
}

export type CliSessionRevisionSyncState = {
  currentSyncedRevision?: CliSyncedRevision
  latestSyncedRevision?: CliSyncedRevision
}

export type CliConfig = {
  schemaVersion: 2
  apiBaseUrl: string
  webBaseUrl: string
  authToken?: string
  authUserId?: string
  authUserEmail?: string
  authUserName?: string
  lastLoginAt?: string
  lastSyncAt?: string
  syncedRevisions?: Record<string, CliSyncedRevision>
}
