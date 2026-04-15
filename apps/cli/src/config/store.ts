import Conf, { type Options as ConfOptions } from 'conf'
import type { ProviderId } from '@howicc/canonical'
import type {
  CliConfig,
  CliSessionRevisionSyncState,
  CliSyncedRevision,
} from '../types'
import { cliEnv } from '../env'

type CliLegacySessionSyncState = {
  conversationId: string
  revisionId: string
  sourceRevisionHash: string
  syncedAt: string
}

type CliConfigStoreData = CliConfig & {
  schemaVersion: 1 | 2
  sessionSyncState?: Record<string, CliLegacySessionSyncState>
}

const CURRENT_CONFIG_SCHEMA_VERSION = 2

const defaults: CliConfigStoreData = {
  schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
  apiBaseUrl: cliEnv.HOWICC_API_URL,
  webBaseUrl: cliEnv.HOWICC_WEB_URL,
}

type CliConfigStoreOptions = Readonly<Partial<ConfOptions<CliConfigStoreData>>>

const getRuntimeApiBaseUrl = () => process.env.HOWICC_API_URL

const getRuntimeWebBaseUrl = () => process.env.HOWICC_WEB_URL

export class CliConfigStore {
  private readonly config: Conf<CliConfigStoreData>

  constructor(options: CliConfigStoreOptions = {}) {
    this.config = new Conf<CliConfigStoreData>({
      projectName: 'howicc-v2',
      defaults,
      ...options,
    })

    this.migrateLegacySyncState()
  }

  getAll(): CliConfig {
    return {
      schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      apiBaseUrl: this.getApiBaseUrl(),
      webBaseUrl: this.getWebBaseUrl(),
      authToken: this.getAuthToken(),
      authUserId: this.config.get('authUserId'),
      authUserEmail: this.config.get('authUserEmail'),
      authUserName: this.config.get('authUserName'),
      lastLoginAt: this.config.get('lastLoginAt'),
      lastSyncAt: this.config.get('lastSyncAt'),
      syncedRevisions: this.config.get('syncedRevisions'),
    }
  }

  getApiBaseUrl(): string {
    return getRuntimeApiBaseUrl() ?? this.config.get('apiBaseUrl') ?? defaults.apiBaseUrl
  }

  setApiBaseUrl(value: string): void {
    this.config.set('apiBaseUrl', value)
  }

  getWebBaseUrl(): string {
    return getRuntimeWebBaseUrl() ?? this.config.get('webBaseUrl') ?? defaults.webBaseUrl
  }

  setWebBaseUrl(value: string): void {
    this.config.set('webBaseUrl', value)
  }

  getAuthToken(): string | undefined {
    return this.config.get('authToken')
  }

  setAuthToken(input: {
    token: string
    user?: {
      id: string
      email: string
      name: string
    }
  }): void {
    this.config.set('authToken', input.token)

    if (input.user) {
      this.config.set('authUserId', input.user.id)
      this.config.set('authUserEmail', input.user.email)
      this.config.set('authUserName', input.user.name)
    }

    this.config.set('lastLoginAt', new Date().toISOString())
  }

  clearAuthToken(): void {
    this.config.delete('authToken')
    this.config.delete('authUserId')
    this.config.delete('authUserEmail')
    this.config.delete('authUserName')
    this.config.delete('lastLoginAt')
  }

  getPath(): string {
    return this.config.path
  }

  reset(): void {
    this.config.clear()
  }

  getSyncedRevisions(): Record<string, CliSyncedRevision> {
    return this.config.get('syncedRevisions') ?? {}
  }

  getSyncedRevision(input: {
    provider: ProviderId
    sessionId: string
    sourceRevisionHash: string
  }): CliSyncedRevision | undefined {
    return this.getSyncedRevisions()[buildSyncedRevisionKey(input)]
  }

  getLatestSyncedRevisionForSession(input: {
    provider: ProviderId
    sessionId: string
  }): CliSyncedRevision | undefined {
    return Object.values(this.getSyncedRevisions())
      .filter(
        revision =>
          revision.provider === input.provider &&
          revision.sessionId === input.sessionId,
      )
      .sort((left, right) => Date.parse(right.syncedAt) - Date.parse(left.syncedAt))[0]
  }

  getSessionRevisionSyncState(input: {
    provider: ProviderId
    sessionId: string
    sourceRevisionHash?: string
  }): CliSessionRevisionSyncState {
    const latestSyncedRevision = this.getLatestSyncedRevisionForSession({
      provider: input.provider,
      sessionId: input.sessionId,
    })
    const currentSyncedRevision = input.sourceRevisionHash
      ? this.getSyncedRevision({
          provider: input.provider,
          sessionId: input.sessionId,
          sourceRevisionHash: input.sourceRevisionHash,
        })
      : undefined

    return {
      currentSyncedRevision,
      latestSyncedRevision,
    }
  }

  clearSyncedRevisions(): void {
    this.config.delete('syncedRevisions')
    this.config.delete('lastSyncAt')
  }

  setSyncedRevision(value: CliSyncedRevision): void {
    const current = this.getSyncedRevisions()
    const existingLastSyncAt = this.config.get('lastSyncAt')
    const lastSyncAt =
      !existingLastSyncAt || Date.parse(value.syncedAt) > Date.parse(existingLastSyncAt)
        ? value.syncedAt
        : existingLastSyncAt

    this.config.set('syncedRevisions', {
      ...current,
      [buildSyncedRevisionKey(value)]: value,
    })
    this.config.set('lastSyncAt', lastSyncAt)
  }

  private migrateLegacySyncState(): void {
    const schemaVersion = this.config.get('schemaVersion') ?? 1
    const legacySessionSyncState = this.config.get('sessionSyncState')

    if (schemaVersion >= CURRENT_CONFIG_SCHEMA_VERSION && !legacySessionSyncState) {
      return
    }

    if (legacySessionSyncState && Object.keys(legacySessionSyncState).length > 0) {
      const migratedRevisions = {
        ...this.getSyncedRevisions(),
      }

      for (const [sessionId, syncedRevision] of Object.entries(legacySessionSyncState)) {
        const revision: CliSyncedRevision = {
          provider: 'claude_code',
          sessionId,
          conversationId: syncedRevision.conversationId,
          revisionId: syncedRevision.revisionId,
          sourceRevisionHash: syncedRevision.sourceRevisionHash,
          syncedAt: syncedRevision.syncedAt,
        }

        migratedRevisions[buildSyncedRevisionKey(revision)] = revision
      }

      this.config.set('syncedRevisions', migratedRevisions)
      this.config.delete('sessionSyncState')
    }

    this.config.set('schemaVersion', CURRENT_CONFIG_SCHEMA_VERSION)
  }
}

const buildSyncedRevisionKey = (input: {
  provider: ProviderId
  sessionId: string
  sourceRevisionHash: string
}) => `${input.provider}:${input.sessionId}:${input.sourceRevisionHash}`
