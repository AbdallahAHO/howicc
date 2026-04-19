import { and, eq } from 'drizzle-orm'
import type { CanonicalSession } from '@howicc/canonical'
import { extractSessionDigest } from '@howicc/profile'
import {
  conversationAssets,
  conversationRevisions,
  conversations,
  uploadSessionAssets,
  uploadSessions,
} from '@howicc/db/schema'
import { parseGzipJson, type StorageAdapter } from '@howicc/storage'
import {
  buildCanonicalKey,
  buildRenderKey,
  buildSourceBundleKey,
} from '@howicc/storage/paths'
import { ApiError } from '../../lib/api-error'
import {
  getRuntimeDatabase,
  getRuntimeStorage,
} from '../../lib/runtime-resources'
import {
  sha256Hex,
  type AuthenticatedCliUser,
} from '../../lib/cli-token-auth'
import type { ApiRuntime } from '../../runtime'
import { upsertSessionDigest } from '../profile/service'

type UploadAssetKind = 'source_bundle' | 'canonical_json' | 'render_json'

type DraftUploadAsset = {
  kind: UploadAssetKind
  bytes: number
  sha256: string
}

type FinalizeRevisionInput = {
  uploadId: string
  sourceRevisionHash: string
  conversationId?: string
  sourceApp: string
  sourceSessionId: string
  sourceProjectKey: string
  title: string
  assets: Array<{
    kind: UploadAssetKind
    key: string
    sha256: string
    bytes: number
  }>
}

type RuntimeDatabase = ReturnType<typeof getRuntimeDatabase>
type UploadDatabase = RuntimeDatabase
type UploadSessionRow = typeof uploadSessions.$inferSelect
type UploadSessionAssetRow = typeof uploadSessionAssets.$inferSelect
type ConversationRow = typeof conversations.$inferSelect
type RevisionUploadResult = {
  conversationId: string
  revisionId: string
}
type StoredDraftObject = {
  asset: UploadSessionAssetRow
  body: ArrayBuffer
  contentType?: string
}

export const createRevisionUploadSession = async (
  runtime: ApiRuntime,
  user: AuthenticatedCliUser,
  input: { sourceRevisionHash: string; assets: DraftUploadAsset[] },
) => {
  const db = getRuntimeDatabase(runtime)
  const now = new Date()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  const uploadId = `upload_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`

  await db.insert(uploadSessions).values({
    id: uploadId,
    userId: user.id,
    sourceRevisionHash: input.sourceRevisionHash,
    status: 'draft',
    expiresAt,
    createdAt: now,
  })

  await db.insert(uploadSessionAssets).values(
    input.assets.map(asset => ({
      id: `uasset_${createStableHash(`${uploadId}:${asset.kind}`).slice(0, 16)}`,
      uploadSessionId: uploadId,
      kind: asset.kind,
      storageKey: buildDraftAssetKey(uploadId, asset.kind),
      sha256: asset.sha256,
      bytes: asset.bytes,
      contentType: getAssetContentType(asset.kind),
      createdAt: now,
    })),
  )

  return {
    uploadId,
    assetTargets: input.assets.map(asset => ({
      kind: asset.kind,
      key: buildDraftAssetKey(uploadId, asset.kind),
      uploadPath: `/uploads/${uploadId}/assets/${asset.kind}`,
    })),
  }
}

export const uploadRevisionAssetBytes = async (
  runtime: ApiRuntime,
  user: AuthenticatedCliUser,
  input: {
    uploadId: string
    kind: UploadAssetKind
    body: ArrayBuffer
    contentType?: string
  },
) => {
  const db = getRuntimeDatabase(runtime)
  const storage = getRuntimeStorage(runtime)
  const uploadSession = await requireOwnedUploadSession(db, input.uploadId, user.id)
  const draftSession = await requireActiveDraftUploadSession(db, uploadSession)

  if (draftSession.sourceRevisionHash.length === 0) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The upload session source revision hash is invalid.',
    )
  }

  const assets = await db
    .select()
    .from(uploadSessionAssets)
    .where(
      and(
        eq(uploadSessionAssets.uploadSessionId, input.uploadId),
        eq(uploadSessionAssets.kind, input.kind),
      ),
    )
    .limit(1)

  const asset = assets[0]

  if (!asset) {
    throw new ApiError(
      'uploadAssetTargetMissing',
      `No draft asset target was created for ${input.kind}.`,
    )
  }

  const actualBytes = input.body.byteLength
  if (actualBytes !== asset.bytes) {
    throw new ApiError(
      'uploadRequestInvalid',
      `Asset ${input.kind} expected ${asset.bytes} bytes but received ${actualBytes}.`,
    )
  }

  const actualSha256 = await sha256Hex(input.body)
  if (actualSha256 !== asset.sha256) {
    throw new ApiError(
      'uploadRequestInvalid',
      `Asset ${input.kind} sha256 mismatch for draft upload ${input.uploadId}.`,
    )
  }

  await storage.putObject({
    key: asset.storageKey,
    body: input.body,
    contentType:
      input.contentType ?? asset.contentType ?? getAssetContentType(input.kind),
    metadata: {
      uploadId: input.uploadId,
      kind: input.kind,
      sourceRevisionHash: draftSession.sourceRevisionHash,
    },
  })

  await db
    .update(uploadSessionAssets)
    .set({
      contentType: input.contentType ?? asset.contentType,
      uploadedAt: new Date(),
    })
    .where(eq(uploadSessionAssets.id, asset.id))

  return {
    uploadId: input.uploadId,
    kind: input.kind,
    key: asset.storageKey,
    bytes: actualBytes,
    sha256: actualSha256,
  }
}

export const finalizeRevisionUpload = async (
  runtime: ApiRuntime,
  user: AuthenticatedCliUser,
  input: FinalizeRevisionInput,
) => {
  const db = getRuntimeDatabase(runtime)
  const storage = getRuntimeStorage(runtime)
  const uploadSession = await requireOwnedUploadSession(db, input.uploadId, user.id)

  if (uploadSession.status === 'finalized') {
    return requireExistingFinalizeResult(db, user.id, input)
  }

  const draftSession = await requireActiveDraftUploadSession(db, uploadSession)

  if (draftSession.sourceRevisionHash !== input.sourceRevisionHash) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The finalize request does not match the draft upload source revision hash.',
    )
  }

  const draftAssets = await db
    .select()
    .from(uploadSessionAssets)
    .where(eq(uploadSessionAssets.uploadSessionId, input.uploadId))

  assertFinalizeAssetsMatchDraft(input.assets, draftAssets)

  const draftObjects = await loadDraftObjects(storage, draftAssets)
  const canonicalDraftObject = requireDraftObject(draftObjects, 'canonical_json')
  const renderDraftObject = requireDraftObject(draftObjects, 'render_json')

  const canonical = parseDraftCanonical(canonicalDraftObject)
  parseDraftRender(renderDraftObject)
  assertCanonicalMatchesFinalizeRequest(canonical, input)

  let copiedAssets:
    | {
        finalAssets: Array<{
          kind: UploadAssetKind
          storageKey: string
          sha256: string
          bytes: number
          contentType?: string | null
        }>
        draftKeysToDelete: string[]
        createdFinalKeys: string[]
      }
    | undefined

  try {
    copiedAssets = await copyDraftAssetsToFinalKeys(
      storage,
      await getConversationStorageId(db, user, input),
      input.sourceRevisionHash,
      draftObjects,
    )
    const finalizedAssets = copiedAssets.finalAssets

    const latestUploadSession = await requireOwnedUploadSession(
      db,
      input.uploadId,
      user.id,
    )

    if (latestUploadSession.status === 'finalized') {
      return requireExistingFinalizeResult(db, user.id, input)
    }

    await requireActiveDraftUploadSession(db, latestUploadSession)

    // Worker D1 rejects Drizzle transaction(), so finalize stays idempotent instead.
    const conversation = await findOrCreateConversation(db, user, input)
    const revision = await findOrCreateRevision(
      db,
      conversation.id,
      canonical,
      input,
    )
    const now = new Date()

    await upsertRevisionAssets(db, revision.id, finalizedAssets)

    await db
      .update(conversations)
      .set({
        title: input.title,
        currentRevisionId: revision.id,
        status: 'ready',
        updatedAt: now,
      })
      .where(eq(conversations.id, conversation.id))

    const finalized = await db
      .update(uploadSessions)
      .set({ status: 'finalized', finalizedAt: now })
      .where(
        and(
          eq(uploadSessions.id, input.uploadId),
          eq(uploadSessions.userId, user.id),
          eq(uploadSessions.status, 'draft'),
        ),
      )
      .returning({ id: uploadSessions.id })

    const result = finalized[0]
      ? ({
          conversationId: conversation.id,
          revisionId: revision.id,
        } satisfies RevisionUploadResult)
      : await requireExistingFinalizeResult(db, user.id, input)

    await deleteStorageObjects(storage, copiedAssets.draftKeysToDelete)

    try {
      const digest = extractSessionDigest(canonical)
      await upsertSessionDigest(runtime, {
        id: `digest_${result.revisionId}`,
        conversationId: result.conversationId,
        revisionId: result.revisionId,
        ownerUserId: user.id,
        digest,
      })
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to persist session digest after upload finalization.',
          uploadId: input.uploadId,
          conversationId: result.conversationId,
          revisionId: result.revisionId,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }

    return result
  } catch (error) {
    if (
      copiedAssets &&
      !(error instanceof ApiError && error.errorName === 'uploadConflict')
    ) {
      await deleteStorageObjects(storage, copiedAssets.createdFinalKeys)
    }

    throw error
  }
}

const requireOwnedUploadSession = async (
  db: UploadDatabase,
  uploadId: string,
  userId: string,
) => {
  const sessions = await db
    .select()
    .from(uploadSessions)
    .where(
      and(
        eq(uploadSessions.id, uploadId),
        eq(uploadSessions.userId, userId),
      ),
    )
    .limit(1)

  const uploadSession = sessions[0]

  if (!uploadSession) {
    throw new ApiError(
      'uploadSessionNotFound',
      'The upload session could not be found.',
    )
  }

  return uploadSession
}

const requireActiveDraftUploadSession = async (
  db: UploadDatabase,
  uploadSession: UploadSessionRow,
) => {
  if (uploadSession.status === 'finalized') {
    throw new ApiError(
      'uploadConflict',
      'The upload session has already been finalized.',
    )
  }

  if (uploadSession.status !== 'draft') {
    throw new ApiError(
      'uploadConflict',
      'The upload session is no longer accepting changes.',
    )
  }

  if (uploadSession.expiresAt.getTime() < Date.now()) {
    await db
      .update(uploadSessions)
      .set({ status: 'expired' })
      .where(eq(uploadSessions.id, uploadSession.id))

    throw new ApiError(
      'uploadExpired',
      'The upload session has expired. Start a new sync and try again.',
    )
  }

  return uploadSession
}

const assertFinalizeAssetsMatchDraft = (
  requestedAssets: FinalizeRevisionInput['assets'],
  draftAssets: UploadSessionAssetRow[],
) => {
  if (requestedAssets.length !== draftAssets.length) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The finalize request did not include the expected number of assets.',
    )
  }

  for (const draftAsset of draftAssets) {
    const requestedAsset = requestedAssets.find(asset => asset.kind === draftAsset.kind)

    if (!draftAsset.uploadedAt) {
      throw new ApiError(
        'uploadConflict',
        `Draft asset ${draftAsset.kind} has not been uploaded yet.`,
      )
    }

    if (!requestedAsset) {
      throw new ApiError(
        'uploadRequestInvalid',
        `Finalize request is missing the ${draftAsset.kind} asset.`,
      )
    }

    if (
      requestedAsset.key !== draftAsset.storageKey ||
      requestedAsset.sha256 !== draftAsset.sha256 ||
      requestedAsset.bytes !== draftAsset.bytes
    ) {
      throw new ApiError(
        'uploadRequestInvalid',
        `Finalize metadata for ${draftAsset.kind} does not match the draft upload session.`,
      )
    }
  }
}

const findConversationBySource = async (
  db: UploadDatabase,
  userId: string,
  input: Pick<
    FinalizeRevisionInput,
    'conversationId' | 'sourceApp' | 'sourceSessionId'
  >,
) => {
  if (input.conversationId) {
    const byId = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.ownerUserId, userId),
        ),
      )
      .limit(1)

    if (byId[0]) {
      assertConversationMatchesSource(byId[0], input)
      return byId[0]
    }
  }

  const bySource = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.ownerUserId, userId),
        eq(conversations.sourceApp, input.sourceApp),
        eq(conversations.sourceSessionId, input.sourceSessionId),
      ),
    )
    .limit(1)

  return bySource[0]
}

const findConversationById = async (
  db: UploadDatabase,
  conversationId: string,
) => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  return rows[0]
}

const findOrCreateConversation = async (
  db: UploadDatabase,
  user: AuthenticatedCliUser,
  input: Pick<
    FinalizeRevisionInput,
    'conversationId' | 'sourceApp' | 'sourceSessionId' | 'sourceProjectKey' | 'title'
  >,
) => {
  const existing = await findConversationBySource(db, user.id, input)
  if (existing) {
    return existing
  }

  const now = new Date()
  const conversationId = `conv_${createStableHash(
    `${user.id}:${input.sourceApp}:${input.sourceSessionId}`,
  ).slice(0, 12)}`

  const findBySource = () =>
    findConversationBySource(db, user.id, {
      conversationId: input.conversationId,
      sourceApp: input.sourceApp,
      sourceSessionId: input.sourceSessionId,
    })

  const findById = () => findConversationById(db, conversationId)
  const baseSlug = buildConversationSlug(input.title, input.sourceSessionId)

  for (let attempt = 0; attempt < conversationSlugReservationAttempts; attempt += 1) {
    const slug = await resolveUniqueSlug(
      db,
      buildConversationSlugCandidate(baseSlug, conversationId, attempt),
      conversationId,
    )
    const conversationRow = buildConversationRow({
      conversationId,
      userId: user.id,
      slug,
      title: input.title,
      sourceApp: input.sourceApp,
      sourceSessionId: input.sourceSessionId,
      sourceProjectKey: input.sourceProjectKey,
      now,
    })

    try {
      await db.insert(conversations).values(conversationRow)
      return conversationRow
    } catch (error) {
      if (!isConstraintViolation(error)) {
        throw new ApiError(
          'internalError',
          'Could not create the conversation record.',
        )
      }

      const raced = await findBySource()
      if (raced) return raced

      const created = await findById()
      if (created) return created
    }
  }

  throw new ApiError(
    'internalError',
    'Could not reserve a unique conversation slug. Please retry the sync.',
  )
}

const findOrCreateRevision = async (
  db: UploadDatabase,
  conversationId: string,
  canonical: CanonicalSession,
  input: Pick<FinalizeRevisionInput, 'sourceRevisionHash'>,
) => {
  const findByHash = () =>
    db
      .select()
      .from(conversationRevisions)
      .where(
        and(
          eq(conversationRevisions.conversationId, conversationId),
          eq(
            conversationRevisions.sourceRevisionHash,
            input.sourceRevisionHash,
          ),
        ),
      )
      .limit(1)

  const existing = await findByHash()
  if (existing[0]) {
    return existing[0]
  }

  const revisionId = `rev_${createStableHash(
    `${conversationId}:${input.sourceRevisionHash}`,
  ).slice(0, 12)}`

  try {
    await db.insert(conversationRevisions).values({
      id: revisionId,
      conversationId,
      sourceRevisionHash: input.sourceRevisionHash,
      parserVersion: canonical.parserVersion,
      canonicalSchemaVersion: canonical.schemaVersion,
      renderSchemaVersion: 1,
      selectedLeafUuid: canonical.selection.selectedLeafUuid ?? null,
      summary: canonical.metadata.summary ?? null,
      safetyFlagsJson: null,
      statsJson: JSON.stringify(canonical.stats),
      searchText: canonical.searchText,
      createdAt: new Date(),
    })
  } catch (error) {
    if (isConstraintViolation(error)) {
      const raced = await findByHash()
      if (raced[0]) return raced[0]
    }
    throw error
  }

  const created = await db
    .select()
    .from(conversationRevisions)
    .where(eq(conversationRevisions.id, revisionId))
    .limit(1)

  if (!created[0]) {
    throw new ApiError(
      'internalError',
      'The conversation revision row could not be created.',
    )
  }

  return created[0]
}

const getConversationStorageId = async (
  db: UploadDatabase,
  user: AuthenticatedCliUser,
  input: Pick<
    FinalizeRevisionInput,
    'conversationId' | 'sourceApp' | 'sourceSessionId'
  >,
) => {
  const existingConversation = await findConversationBySource(db, user.id, input)
  if (existingConversation) {
    return existingConversation.id
  }

  return `conv_${createStableHash(
    `${user.id}:${input.sourceApp}:${input.sourceSessionId}`,
  ).slice(0, 12)}`
}

const requireExistingFinalizeResult = async (
  db: UploadDatabase,
  userId: string,
  input: Pick<
    FinalizeRevisionInput,
    'conversationId' | 'sourceApp' | 'sourceSessionId' | 'sourceRevisionHash'
  >,
): Promise<RevisionUploadResult> => {
  const conversation = await findConversationBySource(db, userId, input)

  if (!conversation) {
    throw new ApiError(
      'uploadConflict',
      'The upload session was already finalized but no conversation record could be recovered.',
    )
  }

  const revisions = await db
    .select()
    .from(conversationRevisions)
    .where(
      and(
        eq(conversationRevisions.conversationId, conversation.id),
        eq(
          conversationRevisions.sourceRevisionHash,
          input.sourceRevisionHash,
        ),
      ),
    )
    .limit(1)

  const revision = revisions[0]

  if (!revision) {
    throw new ApiError(
      'uploadConflict',
      'The upload session was already finalized but no matching revision could be recovered.',
    )
  }

  return {
    conversationId: conversation.id,
    revisionId: revision.id,
  }
}

const loadDraftObjects = async (
  storage: StorageAdapter,
  draftAssets: UploadSessionAssetRow[],
): Promise<StoredDraftObject[]> =>
  Promise.all(
    draftAssets.map(async asset => {
      const object = await storage.getObject(asset.storageKey)

      if (!object || object.body == null) {
        throw new ApiError(
          'uploadConflict',
          `Draft asset ${asset.kind} could not be loaded from storage.`,
        )
      }

      return {
        asset,
        body: toArrayBuffer(object.body),
        contentType: asset.contentType ?? object.contentType,
      }
    }),
  )

const requireDraftObject = (
  draftObjects: StoredDraftObject[],
  kind: UploadAssetKind,
) => {
  const draftObject = draftObjects.find(object => object.asset.kind === kind)

  if (!draftObject) {
    throw new ApiError(
      'uploadConflict',
      `The draft upload is missing the ${kind} asset.`,
    )
  }

  return draftObject
}

const parseDraftCanonical = (draftObject: StoredDraftObject) => {
  try {
    return parseGzipJson<CanonicalSession>(draftObject.body)
  } catch {
    throw new ApiError(
      'uploadRequestInvalid',
      'The uploaded canonical asset is not valid gzip JSON.',
    )
  }
}

const parseDraftRender = (draftObject: StoredDraftObject) => {
  try {
    parseGzipJson<unknown>(draftObject.body)
  } catch {
    throw new ApiError(
      'uploadRequestInvalid',
      'The uploaded render asset is not valid gzip JSON.',
    )
  }
}

const assertCanonicalMatchesFinalizeRequest = (
  canonical: CanonicalSession,
  input: FinalizeRevisionInput,
) => {
  if (canonical.source.sourceRevisionHash !== input.sourceRevisionHash) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The uploaded canonical session does not match the finalize source revision hash.',
    )
  }

  if (canonical.source.sessionId !== input.sourceSessionId) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The uploaded canonical session does not match the finalize source session id.',
    )
  }

  if (canonical.source.projectKey !== input.sourceProjectKey) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The uploaded canonical session does not match the finalize project key.',
    )
  }
}

const copyDraftAssetsToFinalKeys = async (
  storage: StorageAdapter,
  conversationId: string,
  sourceRevisionHash: string,
  draftObjects: StoredDraftObject[],
) => {
  const revisionStorageId = await sha256Hex(sourceRevisionHash)
  const finalKeys = {
    source_bundle: buildSourceBundleKey(conversationId, revisionStorageId),
    canonical_json: buildCanonicalKey(conversationId, revisionStorageId),
    render_json: buildRenderKey(conversationId, revisionStorageId),
  } satisfies Record<UploadAssetKind, string>

  const finalAssets = [] as Array<{
    kind: UploadAssetKind
    storageKey: string
    sha256: string
    bytes: number
    contentType?: string | null
  }>
  const draftKeysToDelete = [] as string[]
  const createdFinalKeys = [] as string[]

  try {
    for (const draftObject of draftObjects) {
      const finalKey = finalKeys[draftObject.asset.kind as UploadAssetKind]

      await storage.putObject({
        key: finalKey,
        body: draftObject.body,
        contentType: draftObject.contentType,
        metadata: {
          revisionHash: sourceRevisionHash,
          kind: draftObject.asset.kind,
        },
      })

      createdFinalKeys.push(finalKey)
      draftKeysToDelete.push(draftObject.asset.storageKey)

      finalAssets.push({
        kind: draftObject.asset.kind as UploadAssetKind,
        storageKey: finalKey,
        sha256: draftObject.asset.sha256,
        bytes: draftObject.asset.bytes,
        contentType: draftObject.asset.contentType,
      })
    }
  } catch (error) {
    await deleteStorageObjects(storage, createdFinalKeys)
    throw error
  }

  return { finalAssets, draftKeysToDelete, createdFinalKeys }
}

const upsertRevisionAssets = async (
  db: UploadDatabase,
  revisionId: string,
  assets: Array<{
    kind: UploadAssetKind
    storageKey: string
    sha256: string
    bytes: number
    contentType?: string | null
  }>,
) => {
  for (const asset of assets) {
    try {
      await db.insert(conversationAssets).values({
        id: `asset_${createStableHash(`${revisionId}:${asset.kind}`).slice(0, 16)}`,
        revisionId,
        kind: asset.kind,
        storageKey: asset.storageKey,
        sha256: asset.sha256,
        bytes: asset.bytes,
        metaJson: JSON.stringify({ contentType: asset.contentType ?? undefined }),
      })
    } catch (error) {
      if (isConstraintViolation(error)) {
        continue
      }
      throw error
    }
  }
}

const assertConversationMatchesSource = (
  conversation: ConversationRow,
  input: Pick<FinalizeRevisionInput, 'sourceApp' | 'sourceSessionId'>,
) => {
  if (
    conversation.sourceApp !== input.sourceApp ||
    conversation.sourceSessionId !== input.sourceSessionId
  ) {
    throw new ApiError(
      'uploadRequestInvalid',
      'The finalize request does not match the target conversation source.',
    )
  }
}

const deleteStorageObjects = async (
  storage: StorageAdapter,
  keys: string[],
) => {
  await Promise.all(
    keys.map(key => storage.deleteObject(key).catch(() => undefined)),
  )
}

const toArrayBuffer = (body: ArrayBuffer | Uint8Array | string) => {
  if (body instanceof ArrayBuffer) {
    return body
  }

  if (typeof body === 'string') {
    return new TextEncoder().encode(body).buffer
  }

  return Uint8Array.from(body).buffer
}

const buildDraftAssetKey = (uploadId: string, kind: UploadAssetKind) =>
  `draft-uploads/${uploadId}/${kind}`

const getAssetContentType = (kind: UploadAssetKind) => {
  switch (kind) {
    case 'source_bundle':
      return 'application/gzip'
    case 'canonical_json':
      return 'application/gzip'
    case 'render_json':
      return 'application/gzip'
  }
}

const buildConversationSlug = (title: string, fallback: string) => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return slug || fallback.toLowerCase()
}

const conversationSlugReservationAttempts = 5

const buildConversationSlugCandidate = (
  baseSlug: string,
  conversationId: string,
  attempt: number,
) => {
  if (attempt === 0) {
    return baseSlug
  }

  const suffix = conversationId.slice(-6)

  if (attempt === 1) {
    return `${baseSlug}-${suffix}`
  }

  const extra = createStableHash(`${conversationId}:${attempt}`).slice(0, 4)
  return `${baseSlug}-${suffix}-${extra}`
}

const buildConversationRow = (input: {
  conversationId: string
  userId: string
  slug: string
  title: string
  sourceApp: string
  sourceSessionId: string
  sourceProjectKey: string
  now: Date
}): ConversationRow => ({
  id: input.conversationId,
  ownerUserId: input.userId,
  slug: input.slug,
  title: input.title,
  visibility: 'private',
  status: 'draft',
  sourceApp: input.sourceApp,
  sourceSessionId: input.sourceSessionId,
  sourceProjectKey: input.sourceProjectKey,
  currentRevisionId: null,
  createdAt: input.now,
  updatedAt: input.now,
})

/**
 * Resolves a slug that does not collide with any existing conversation.
 *
 * If the base slug is free — or already owned by the conversation we're about
 * to upsert — it is returned as-is. Otherwise a stable suffix derived from
 * the conversation id is appended, making the final slug deterministic for
 * a given (user, source session) pair.
 *
 * @example
 * const slug = await resolveUniqueSlug(db, 'welcome-refactor', 'conv_abc123456789')
 * // → 'welcome-refactor' or 'welcome-refactor-456789' on collision
 */
const resolveUniqueSlug = async (
  db: UploadDatabase,
  baseSlug: string,
  conversationId: string,
): Promise<string> => {
  const suffix = conversationId.slice(-6)

  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.slug, baseSlug))
    .limit(1)

  if (existing.length === 0) return baseSlug
  if (existing[0]!.id === conversationId) return baseSlug

  const candidate = `${baseSlug}-${suffix}`
  const collidingCandidate = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.slug, candidate))
    .limit(1)

  if (collidingCandidate.length === 0 || collidingCandidate[0]!.id === conversationId) {
    return candidate
  }

  // Extremely unlikely — both the base slug and the deterministic suffix are
  // taken by different conversations. Fall back to a timestamp-suffixed slug
  // so the insert still succeeds.
  return `${baseSlug}-${suffix}-${Date.now().toString(36)}`
}

const createStableHash = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0).toString(16).padStart(8, '0')
}

const isConstraintViolation = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('unique constraint') ||
    message.includes('unique_constraint') ||
    message.includes('sqlite_constraint')
  )
}
