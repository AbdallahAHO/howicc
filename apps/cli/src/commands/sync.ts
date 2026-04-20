import chalk from 'chalk'
import ora from 'ora'
import { checkbox, confirm, select } from '@inquirer/prompts'
import { deriveApiErrorRenderState, isApiErrorResponse } from '@howicc/api-client'
import type { DiscoveredSession } from '@howicc/parser-core'
import { CliConfigStore } from '../config/store'
import { createCliApiClient } from '../lib/api'
import {
  discoverClaudeSessions,
  getPricingCatalog,
} from '../lib/claude'
import {
  printError,
  printHint,
  printInfo,
  printSection,
  printSuccess,
  printTitle,
  printWarning,
} from '../lib/output'
import { safePrompt } from '../lib/prompt'
import {
  formatLocalSessionSyncLabel,
  formatProjectDisplayPath,
  formatShortSessionId,
  getLocalSessionSyncStatus,
  getSessionTitle,
  truncateText,
} from '../lib/session-display'
import {
  prepareSessionSync,
  selectDefaultSessionsForSync,
  selectSessionsForSync,
  shouldSkipSessionSync,
} from '../lib/sync'
import {
  formatPrivacySanitizationReport,
  formatPrivacyFinding,
  formatPrivacySummary,
  getTopPrivacyFindings,
} from '../lib/privacy'
import type {
  CliPreparedSessionPrivacy,
  CliPrivacyPreflight,
  CliSyncPrivacyMode,
} from '../lib/privacy'
import type { CliSessionRevisionSyncState } from '../types'

const uploadAssetRetryDelaysMs = [250, 750] as const
const retryableTransportErrorCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

type SyncCommandOptions = {
  all?: boolean
  force?: boolean
  limit?: number
  privacy?: CliSyncPrivacyMode
  recent?: number
  select?: boolean
  yes?: boolean
}

type SyncRunOutcome = {
  sessionId: string
  status: 'skipped' | 'failed'
  reason: string
  detail?: string
}

type SyncSanitizationOutcome = {
  sessionId: string
  detail: string
}

type PrivacyReviewMode = 'ask' | 'approve_all' | 'skip_all'
type PrivacyReviewChoice = 'approve_once' | 'approve_all' | 'skip_once' | 'skip_all'

export const syncCommand = async (
  sessionId?: string,
  options: SyncCommandOptions = {},
) => {
  const store = new CliConfigStore()
  const api = createCliApiClient(store)
  const authToken = store.getAuthToken()

  printTitle('HowiCC Sync')

  if (!authToken) {
    printWarning('Run `howicc login` before syncing conversations.')
    return
  }

  const whoami = await api.cliAuth.whoami().catch(() => undefined)

  if (!whoami?.success) {
    printWarning('The stored CLI token could not be verified. Run `howicc login` again.')
    return
  }

  printInfo(`Syncing as ${whoami.user.email}`)

  const discoveredSessions = await discoverClaudeSessions()

  if (discoveredSessions.length === 0) {
    printInfo('No Claude Code sessions were found to sync.')
    return
  }

  const sessions = await resolveSessionsToSync({
    discoveredSessions,
    sessionId,
    options,
    store,
  })

  if (sessionId && sessions.length === 0) {
    printError(`Session ${sessionId} was not found in local Claude storage.`)
    return
  }

  if (sessions.length === 0) {
    printInfo('No sessions selected for sync.')
    return
  }

  printSection('Sync Plan')
  printHint(`Selected ${sessions.length} session${sessions.length === 1 ? '' : 's'}.`)

  for (const session of sessions.slice(0, 5)) {
    const syncState = getSessionSyncState(store, session)
    console.log(
      `  ${chalk.cyan('•')} ${getSessionTitle({ session })} ${chalk.dim(`(${formatLocalSessionSyncLabel(session, syncState)})`)}`,
    )
  }

  if (sessions.length > 5) {
    printHint(`...and ${sessions.length - 5} more.`)
  }

  console.log()

  const shouldContinue =
    options.yes ||
    await safePrompt(() =>
      confirm({
        message: `Sync ${sessions.length} session${sessions.length === 1 ? '' : 's'} now?`,
        default: true,
      }),
    )

  if (!shouldContinue) {
    printInfo('Cancelled before upload.')
    return
  }

  const pricingCatalog = await getPricingCatalog()
  const privacyMode = options.privacy ?? 'sanitize'
  let syncedCount = 0
  let skippedCount = 0
  let failedCount = 0
  const outcomes: SyncRunOutcome[] = []
  const sanitizationOutcomes: SyncSanitizationOutcome[] = []
  let privacyReviewMode: PrivacyReviewMode = options.yes ? 'approve_all' : 'ask'

  for (const [index, session] of sessions.entries()) {
    const latestSyncedRevision = store.getLatestSyncedRevisionForSession({
      provider: session.provider,
      sessionId: session.sessionId,
    })
    const title = truncateText(getSessionTitle({ session }), 72)
    const spinner = ora(
      buildSessionProgressLabel(index, sessions.length, title, 'preparing local session'),
    ).start()

    try {
      const preparedSession = await prepareSessionSync(session, {
        pricingCatalog,
        privacyMode,
      })
      const currentSyncedRevision = store.getSyncedRevision({
        provider: session.provider,
        sessionId: session.sessionId,
        sourceRevisionHash: preparedSession.sourceRevisionHash,
      })

      if (
        shouldSkipSessionSync({
          previousRevisionHash: currentSyncedRevision?.sourceRevisionHash,
          nextRevisionHash: preparedSession.sourceRevisionHash,
          force: options.force,
        })
      ) {
        skippedCount += 1
        spinner.info(`${title} skipped because the revision hash is unchanged`)
        outcomes.push({
          sessionId: session.sessionId,
          status: 'skipped',
          reason: 'unchanged revision',
        })
        continue
      }

      if (preparedSession.privacy.action === 'block') {
        spinner.stop()
        printPrivacyPreflight(session.sessionId, preparedSession.privacy)
        failedCount += 1
        printError(
          preparedSession.privacy.mode === 'sanitize'
            ? 'Blocked this upload because the sanitized payload still contains sensitive content.'
            : 'Blocked this upload because privacy pre-flight found sensitive content.',
        )
        printHint(
          `Run \`howicc preview ${session.sessionId}\` to inspect the upload-safe preview locally.`,
        )
        spinner.fail(`${title} blocked by privacy pre-flight`)
        outcomes.push({
          sessionId: session.sessionId,
          status: 'failed',
          reason:
            preparedSession.privacy.mode === 'sanitize'
              ? 'sanitized upload still blocked'
              : 'blocked by privacy pre-flight',
        })
        continue
      }

      if (preparedSession.privacy.action === 'review' && !options.yes) {
        spinner.stop()
        printPrivacyPreflight(session.sessionId, preparedSession.privacy)
        const reviewDecision = await resolvePrivacyReviewDecision(privacyReviewMode)
        privacyReviewMode = reviewDecision.mode

        if (!reviewDecision.shouldUpload) {
          skippedCount += 1
          spinner.info(`${title} skipped after privacy review`)
          outcomes.push({
            sessionId: session.sessionId,
            status: 'skipped',
            reason: 'skipped after privacy review',
          })
          continue
        }

        spinner.start()
      }

      spinner.text = buildSessionProgressLabel(
        index,
        sessions.length,
        title,
        'creating upload session',
      )

      const createSessionResult = await api.uploads.createSession({
        sourceRevisionHash: preparedSession.sourceRevisionHash,
        assets: preparedSession.assets.map(asset => ({
          kind: asset.kind,
          bytes: asset.bytes,
          sha256: asset.sha256,
        })),
      })

      if (!createSessionResult) {
        throw new Error('Upload session creation returned no payload.')
      }

      if (!createSessionResult.success) {
        throw new Error(createSessionResult.error)
      }

      const assetKeyByKind = new Map<
        (typeof preparedSession.assets)[number]['kind'],
        string
      >(
        createSessionResult.assetTargets.map(target => [target.kind, target.key]),
      )

      for (const [assetIndex, asset] of preparedSession.assets.entries()) {
        spinner.text = buildSessionProgressLabel(
          index,
          sessions.length,
          title,
          `uploading ${formatAssetKind(asset.kind)} (${assetIndex + 1}/${preparedSession.assets.length})`,
        )
        await uploadAssetWithRetry({
          upload: () => api.uploads.uploadAsset({
            uploadId: createSessionResult.uploadId,
            kind: asset.kind,
            body: asset.body,
            contentType: asset.contentType,
          }),
          kind: asset.kind,
          uploadId: createSessionResult.uploadId,
        })
      }

      spinner.text = buildSessionProgressLabel(
        index,
        sessions.length,
        title,
        'finalizing',
      )

      const finalizeResult = await api.uploads.finalize({
        uploadId: createSessionResult.uploadId,
        sourceRevisionHash: preparedSession.sourceRevisionHash,
        conversationId: latestSyncedRevision?.conversationId,
        sourceApp: preparedSession.sourceApp,
        sourceSessionId: preparedSession.sourceSessionId,
        sourceProjectKey: preparedSession.sourceProjectKey,
        title: preparedSession.title,
        assets: preparedSession.assets.map(asset => {
          const key = assetKeyByKind.get(asset.kind)

          if (!key) {
            throw new Error(`Upload target for ${asset.kind} was not returned by the API.`)
          }

          return {
            kind: asset.kind,
            key,
            sha256: asset.sha256,
            bytes: asset.bytes,
          }
        }),
      })

      if (!finalizeResult) {
        throw new Error('Upload finalization returned no payload.')
      }

      if (!finalizeResult.success) {
        throw new Error(finalizeResult.error)
      }

      const syncedAt = new Date().toISOString()

      store.setSyncedRevision({
        provider: session.provider,
        sessionId: session.sessionId,
        conversationId: finalizeResult.conversationId,
        revisionId: finalizeResult.revisionId,
        sourceRevisionHash: preparedSession.sourceRevisionHash,
        syncedAt,
      })

      syncedCount += 1

      if (preparedSession.privacy.action === 'sanitized') {
        sanitizationOutcomes.push({
          sessionId: session.sessionId,
          detail: formatPrivacySanitizationReport(preparedSession.privacy.report),
        })
      }

      spinner.succeed(
        `${title} synced to ${finalizeResult.conversationId} (${finalizeResult.revisionId})${preparedSession.privacy.action === 'sanitized' ? ' · sanitized' : ''}`,
      )
    } catch (error) {
      failedCount += 1
      const detail = error instanceof Error ? error.message : 'Unknown error'
      spinner.fail(
        `${title} failed: ${detail}`,
      )
      outcomes.push({
        sessionId: session.sessionId,
        status: 'failed',
        reason: 'upload failed',
        detail,
      })
    }
  }

  console.log()
  printSuccess(
    `Finished sync run. ${syncedCount} synced, ${skippedCount} skipped, ${failedCount} failed.`,
  )

  printSanitizationSummary(sanitizationOutcomes)
  printSyncRunSummary(outcomes)

  if (failedCount === 0 && skippedCount > 0 && !options.force) {
    printHint('Use `howicc sync --force` when you want to re-upload unchanged revisions.')
  }
}

/**
 * Retries idempotent asset uploads when the transport flakes or the API returns a retryable
 * server failure. Draft-session conflicts or expirations fail immediately because they require a
 * brand new sync run, not another PUT against the same upload target.
 */
const uploadAssetWithRetry = async (input: {
  upload: () => Promise<unknown>
  kind: string
  uploadId: string
}) => {
  let lastError: unknown

  for (let attempt = 0; attempt <= uploadAssetRetryDelaysMs.length; attempt += 1) {
    try {
      const uploadResult = await input.upload()

      if (!uploadResult) {
        throw new Error(`Uploading ${input.kind} returned no payload.`)
      }

      if (
        typeof uploadResult === 'object' &&
        uploadResult !== null &&
        'success' in uploadResult &&
        uploadResult.success === false
      ) {
        throw uploadResult
      }

      return uploadResult
    } catch (error) {
      lastError = error
      const shouldRetry = shouldRetryUploadAssetAttempt(error)

      if (
        attempt >= uploadAssetRetryDelaysMs.length ||
        !shouldRetry
      ) {
        throw toUploadAssetError({
          error,
          kind: input.kind,
          attempts: attempt + 1,
          exhaustedRetries: shouldRetry,
        })
      }

      const retryDelayMs = uploadAssetRetryDelaysMs[attempt]

      if (retryDelayMs === undefined) {
        throw toUploadAssetError({
          error,
          kind: input.kind,
          attempts: attempt + 1,
          exhaustedRetries: true,
        })
      }

      await sleep(retryDelayMs)
    }
  }

  throw toUploadAssetError({
    error: lastError,
    kind: input.kind,
    attempts: uploadAssetRetryDelaysMs.length + 1,
    exhaustedRetries: true,
  })
}

const shouldRetryUploadAssetAttempt = (error: unknown) => {
  if (isApiErrorResponse(error)) {
    return deriveApiErrorRenderState(error).requiresRetry
  }

  return isRetryableTransportError(error)
}

const isRetryableTransportError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  if (
    error instanceof TypeError ||
    error.name === 'AbortError' ||
    error.name === 'TimeoutError'
  ) {
    return true
  }

  const cause = 'cause' in error ? error.cause : undefined
  const code = getTransportErrorCode(error) ?? getTransportErrorCode(cause)

  return code ? retryableTransportErrorCodes.has(code) : false
}

const getTransportErrorCode = (value: unknown) =>
  value &&
  typeof value === 'object' &&
  'code' in value &&
  typeof value.code === 'string'
    ? value.code
    : undefined

const toUploadAssetError = (input: {
  error: unknown
  kind: string
  attempts: number
  exhaustedRetries: boolean
}) => {
  const message = getUploadAssetErrorMessage(input.error, input.kind)

  if (!input.exhaustedRetries) {
    return new Error(message)
  }

  return new Error(`${message} (after ${input.attempts} attempts)`)
}

const getUploadAssetErrorMessage = (error: unknown, kind: string) => {
  if (isApiErrorResponse(error)) {
    return error.error
  }

  if (error instanceof Error) {
    return error.message
  }

  return `Uploading ${kind} failed.`
}

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const resolveSessionsToSync = async (input: {
  discoveredSessions: DiscoveredSession[]
  sessionId?: string
  options: SyncCommandOptions
  store: CliConfigStore
}) => {
  const recentLimit = getRecentLimit(input.options)

  if (input.sessionId) {
    return selectSessionsForSync({
      sessions: input.discoveredSessions,
      sessionId: input.sessionId,
    })
  }

  if (input.options.all) {
    return selectSessionsForSync({
      sessions: input.discoveredSessions,
      all: true,
    })
  }

  if (input.options.recent || input.options.limit) {
    return selectSessionsForSync({
      sessions: input.discoveredSessions,
      limit: recentLimit,
    })
  }

  if (input.options.select) {
    return selectSessionsInteractively(
      input.discoveredSessions,
      input.store,
      recentLimit,
    )
  }

  if (input.options.yes) {
    return selectDefaultSessionsForSync({
      sessions: input.discoveredSessions,
      getSyncState: session => getSessionSyncState(input.store, session),
      limit: recentLimit,
    })
  }

  return chooseInteractiveSyncPlan(
    input.discoveredSessions,
    input.store,
    recentLimit,
  )
}

const chooseInteractiveSyncPlan = async (
  sessions: DiscoveredSession[],
  store: CliConfigStore,
  recentLimit: number,
) => {
  const defaultSessions = selectDefaultSessionsForSync({
    sessions,
    getSyncState: session => getSessionSyncState(store, session),
    limit: recentLimit,
  })

  const choice = await safePrompt(() =>
    select({
      message: 'What would you like to sync?',
      choices: [
        {
          name: `Sync ${defaultSessions.length} session${defaultSessions.length === 1 ? '' : 's'} that look new or updated`,
          value: 'default',
        },
        {
          name: 'Choose sessions interactively',
          value: 'select',
        },
        {
          name: 'Sync every discovered session',
          value: 'all',
        },
      ],
      default: 'default',
    }),
  )

  if (choice === 'all') {
    return selectSessionsForSync({ sessions, all: true })
  }

  if (choice === 'select') {
    return selectSessionsInteractively(sessions, store, recentLimit)
  }

  return defaultSessions
}

const selectSessionsInteractively = async (
  sessions: DiscoveredSession[],
  store: CliConfigStore,
  recentLimit: number,
) => {
  const maxChoices = Math.max(12, recentLimit * 4)
  const selectionPool = selectSessionsForSync({
    sessions,
    limit: Math.min(maxChoices, sessions.length),
  })

  if (selectionPool.length < sessions.length) {
    printHint(
      `Showing the ${selectionPool.length} most recent sessions in the picker out of ${sessions.length} total. Use \`howicc sync --recent <n>\` for a wider slice.`,
    )
    console.log()
  }

  const sessionIds = await safePrompt(() =>
    checkbox({
      message: 'Select sessions to sync',
      choices: selectionPool.map(session => ({
        name: formatSyncChoice(
          session,
          getSessionSyncState(store, session),
        ),
        value: session.sessionId,
        checked: getLocalSessionSyncStatus(
          session,
          getSessionSyncState(store, session),
        ) !== 'synced',
      })),
      pageSize: Math.min(12, selectionPool.length),
      loop: false,
    }),
  )

  const selectedIds = new Set(sessionIds)
  return selectionPool.filter(session => selectedIds.has(session.sessionId))
}

const formatSyncChoice = (
  session: DiscoveredSession,
  syncState?: CliSessionRevisionSyncState,
) => {
  const syncStatus = getLocalSessionSyncStatus(session, syncState)
  const statusIcon =
    syncStatus === 'synced'
      ? chalk.green('✓')
      : syncStatus === 'updated_since_sync'
        ? chalk.yellow('↻')
        : chalk.gray('•')

  const title = truncateText(getSessionTitle({ session }), 72)
  const meta = [
    formatShortSessionId(session.sessionId),
    session.gitBranch,
    formatProjectDisplayPath(session.projectPath ?? session.projectKey, { maxHead: 1, maxTail: 2 }),
  ].filter(Boolean).join(chalk.dim(' · '))

  return `${statusIcon} ${title}\n  ${chalk.dim(meta)}\n  ${chalk.dim(formatLocalSessionSyncLabel(session, syncState))}`
}

const getSessionSyncState = (
  store: CliConfigStore,
  session: DiscoveredSession,
) =>
  store.getSessionRevisionSyncState({
    provider: session.provider,
    sessionId: session.sessionId,
  })

const getRecentLimit = (options: SyncCommandOptions) => {
  if (options.recent && options.recent > 0) {
    return options.recent
  }

  if (options.limit && options.limit > 0) {
    return options.limit
  }

  return 5
}

const buildSessionProgressLabel = (
  index: number,
  total: number,
  title: string,
  stage: string,
) => `[${index + 1}/${total}] ${title} · ${stage}`

const formatAssetKind = (kind: 'source_bundle' | 'canonical_json' | 'render_json') => {
  switch (kind) {
    case 'source_bundle':
      return 'source bundle'
    case 'canonical_json':
      return 'canonical data'
    case 'render_json':
      return 'render data'
  }
}

const hasPrivacySanitizationChanges = (privacy: CliPreparedSessionPrivacy) =>
  privacy.report.redactedTextValueCount > 0 ||
  privacy.report.removedTextValueCount > 0 ||
  privacy.report.redactedSourceFileCount > 0 ||
  privacy.report.removedSourceFileCount > 0

const printPrivacyPreflight = (
  sessionId: string,
  privacy: CliPreparedSessionPrivacy,
) => {
  printSection(`Privacy Pre-flight · ${formatShortSessionId(sessionId)}`)
  printHint(`Overall: ${formatPrivacySummary(privacy.preflight.inspection.summary)}`)
  printHint(`Source bundle: ${formatPrivacySummary(privacy.preflight.sourceInspection.summary)}`)
  printHint(`Canonical upload: ${formatPrivacySummary(privacy.preflight.canonicalInspection.summary)}`)
  printHint(`Render preview: ${formatPrivacySummary(privacy.preflight.renderInspection.summary)}`)

  if (privacy.mode === 'sanitize') {
    printHint(`Upload payload: ${formatPrivacySummary(privacy.uploadInspection.inspection.summary)}`)

    if (hasPrivacySanitizationChanges(privacy)) {
      printHint(`Sanitized: ${formatPrivacySanitizationReport(privacy.report)}`)
    }
  }

  for (const finding of getTopPrivacyFindings(privacy.preflight.inspection, 3)) {
    printWarning(formatPrivacyFinding(finding))
  }

  console.log()
}

const resolvePrivacyReviewDecision = async (
  currentMode: PrivacyReviewMode,
): Promise<{
  mode: PrivacyReviewMode
  shouldUpload: boolean
}> => {
  if (currentMode === 'approve_all') {
    return {
      mode: currentMode,
      shouldUpload: true,
    }
  }

  if (currentMode === 'skip_all') {
    return {
      mode: currentMode,
      shouldUpload: false,
    }
  }

  const decision = await safePrompt(() =>
    select({
      message: 'Privacy pre-flight found review items for this session.',
      choices: [
        {
          name: 'Upload this session',
          value: 'approve_once',
        },
        {
          name: 'Upload this and all remaining review-only sessions',
          value: 'approve_all',
        },
        {
          name: 'Skip this session',
          value: 'skip_once',
        },
        {
          name: 'Skip this and all remaining review-only sessions',
          value: 'skip_all',
        },
      ],
      default: 'skip_once',
    }),
  ) as PrivacyReviewChoice

  if (decision === 'approve_all') {
    return {
      mode: 'approve_all',
      shouldUpload: true,
    }
  }

  if (decision === 'skip_all') {
    return {
      mode: 'skip_all',
      shouldUpload: false,
    }
  }

  return {
    mode: 'ask',
    shouldUpload: decision === 'approve_once',
  }
}

const printSanitizationSummary = (outcomes: SyncSanitizationOutcome[]) => {
  if (outcomes.length === 0) {
    return
  }

  const groupedOutcomes = new Map<string, SyncSanitizationOutcome[]>()

  for (const outcome of outcomes) {
    const group = groupedOutcomes.get(outcome.detail)

    if (group) {
      group.push(outcome)
      continue
    }

    groupedOutcomes.set(outcome.detail, [outcome])
  }

  printSection('Privacy')

  for (const [detail, group] of groupedOutcomes) {
    const sessionIds = group.map(outcome => formatShortSessionId(outcome.sessionId)).join(', ')
    console.log(`  ${chalk.yellow('•')} sanitized before upload: ${detail} — ${sessionIds}`)
  }

  console.log()
}

const printSyncRunSummary = (outcomes: SyncRunOutcome[]) => {
  if (outcomes.length === 0) {
    return
  }

  const groupedOutcomes = new Map<string, SyncRunOutcome[]>()

  for (const outcome of outcomes) {
    const groupKey = outcome.detail
      ? `${outcome.reason}: ${outcome.detail}`
      : outcome.reason
    const group = groupedOutcomes.get(groupKey)

    if (group) {
      group.push(outcome)
      continue
    }

    groupedOutcomes.set(groupKey, [outcome])
  }

  printSection('Run Summary')

  for (const [groupKey, group] of groupedOutcomes) {
    const prefix =
      group[0]?.status === 'failed'
        ? chalk.red('✗')
        : chalk.yellow('•')
    const sessionIds = group.map(outcome => formatShortSessionId(outcome.sessionId)).join(', ')
    console.log(`  ${prefix} ${groupKey} — ${sessionIds}`)
  }

  console.log()
}
