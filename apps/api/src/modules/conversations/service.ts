import { and, desc, eq, isNotNull } from 'drizzle-orm'
import type { CanonicalSession, SessionArtifact } from '@howicc/canonical'
import { conversationAssets, conversationRevisions, conversations } from '@howicc/db/schema'
import type { ConversationVisibility } from '@howicc/db/schema'
import { parseGzipJson } from '@howicc/storage'
import type { ApiRuntime } from '../../runtime'
import { authenticateCliToken } from '../../lib/cli-token-auth'
import { ApiError } from '../../lib/api-error'
import { getRuntimeDatabase, getRuntimeStorage } from '../../lib/runtime-resources'

export const listUserConversations = async (runtime: ApiRuntime, authorizationHeader?: string) => {
  const user = await authenticateCliToken(runtime, authorizationHeader)

  if (!user) {
    throw new ApiError('cliTokenInvalid', 'Missing or invalid CLI token.')
  }

  const db = getRuntimeDatabase(runtime)
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.ownerUserId, user.id),
        isNotNull(conversations.currentRevisionId),
      ),
    )
    .orderBy(desc(conversations.updatedAt))

  return rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    visibility: row.visibility,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }))
}

export const getStoredRenderDocument = async (
  runtime: ApiRuntime,
  conversationId: string,
  authorizationHeader?: string,
) => {
  const { conversation, renderAsset } = await getConversationAccess(runtime, conversationId, authorizationHeader)
  void conversation

  const storage = getRuntimeStorage(runtime)
  const object = await storage.getObject(renderAsset.storageKey)
  if (!object) {
    throw new ApiError(
      'internalError',
      'The stored render document could not be found in R2.',
    )
  }

  return parseGzipJson<Record<string, unknown>>(object.body as ArrayBuffer)
}

export const getStoredArtifactPreview = async (
  runtime: ApiRuntime,
  conversationId: string,
  artifactId: string,
  authorizationHeader?: string,
) => {
  const { canonicalAsset } = await getConversationAccess(runtime, conversationId, authorizationHeader)
  const storage = getRuntimeStorage(runtime)
  const object = await storage.getObject(canonicalAsset.storageKey)

  if (!object) {
    throw new ApiError(
      'internalError',
      'The stored canonical session could not be found in R2.',
    )
  }

  const canonical = parseGzipJson<CanonicalSession>(object.body as ArrayBuffer)
  const artifact = canonical.artifacts.find(candidate => candidate.id === artifactId)

  if (!artifact) {
    return null
  }

  return {
    artifactId,
    content: renderArtifactPreview(artifact),
  }
}

/**
 * Public-by-slug render document read with owner-awareness.
 *
 * Resolves the most recently updated conversation matching the slug, then
 * gates access: `public` and `unlisted` are world-readable; `private` is
 * only accessible to the owner via CLI bearer token or Better Auth cookie.
 * Returns both the render document and a small `sharedMeta` block so the
 * client can render an "Owner view" affordance without a second fetch.
 *
 * @example
 * const result = await getSharedRenderDocumentBySlug(runtime, 'welcome-refactor', request.headers)
 */
export const getSharedRenderDocumentBySlug = async (
  runtime: ApiRuntime,
  slug: string,
  options: {
    authorizationHeader?: string
    viewerUserId?: string | null
  },
) => {
  const db = getRuntimeDatabase(runtime)

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.slug, slug))
    .limit(1)

  const conversation = rows[0]
  if (!conversation) {
    throw new ApiError('conversationNotFound', 'Conversation not found.')
  }

  const viewerId =
    options.viewerUserId ??
    (await authenticateCliToken(runtime, options.authorizationHeader))?.id ??
    null
  const isOwner = viewerId !== null && viewerId === conversation.ownerUserId

  if (conversation.visibility === 'private' && !isOwner) {
    throw new ApiError('conversationNotFound', 'Conversation not found.')
  }

  if (!conversation.currentRevisionId) {
    throw new ApiError(
      'internalError',
      'Conversation does not have a current revision yet.',
    )
  }

  const assets = await db
    .select()
    .from(conversationAssets)
    .where(eq(conversationAssets.revisionId, conversation.currentRevisionId))

  const renderAsset = assets.find(asset => asset.kind === 'render_json')
  if (!renderAsset) {
    throw new ApiError(
      'internalError',
      'The current revision is missing its stored render document.',
    )
  }

  const storage = getRuntimeStorage(runtime)
  const object = await storage.getObject(renderAsset.storageKey)
  if (!object) {
    throw new ApiError(
      'internalError',
      'The stored render document could not be found in R2.',
    )
  }

  const renderDocument = parseGzipJson<Record<string, unknown>>(object.body as ArrayBuffer)

  return {
    renderDocument,
    sharedMeta: {
      slug: conversation.slug,
      conversationId: conversation.id,
      visibility: conversation.visibility,
      ownerUserId: conversation.ownerUserId,
      isOwner,
      updatedAt: new Date(conversation.updatedAt).toISOString(),
    },
  }
}

/**
 * Owner-only visibility mutation.
 *
 * Treats "not owner" and "does not exist" as the same 404 to avoid leaking
 * conversation existence to non-owners.
 *
 * @example
 * await updateConversationVisibility(runtime, 'conv_1', 'public', { viewerUserId: user.id })
 */
export const updateConversationVisibility = async (
  runtime: ApiRuntime,
  conversationId: string,
  visibility: ConversationVisibility,
  options: {
    authorizationHeader?: string
    viewerUserId?: string | null
  },
) => {
  const db = getRuntimeDatabase(runtime)

  const viewerId =
    options.viewerUserId ??
    (await authenticateCliToken(runtime, options.authorizationHeader))?.id ??
    null

  if (!viewerId) {
    throw new ApiError('authRequired', 'Authentication required.')
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.ownerUserId, viewerId),
      ),
    )
    .limit(1)

  const conversation = rows[0]
  if (!conversation) {
    throw new ApiError('conversationNotFound', 'Conversation not found.')
  }

  const now = new Date()
  await db
    .update(conversations)
    .set({
      visibility,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId))

  return {
    conversationId: conversation.id,
    slug: conversation.slug,
    visibility,
    updatedAt: now.toISOString(),
  }
}

const getConversationAccess = async (
  runtime: ApiRuntime,
  conversationId: string,
  authorizationHeader?: string,
) => {
  const db = getRuntimeDatabase(runtime)
  const user = await authenticateCliToken(runtime, authorizationHeader)

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  const conversation = rows[0]
  if (!conversation) {
    throw new ApiError('conversationNotFound', 'Conversation not found.')
  }

  if (conversation.visibility === 'private' && conversation.ownerUserId !== user?.id) {
    throw new ApiError('conversationNotFound', 'Conversation not found.')
  }

  if (!conversation.currentRevisionId) {
    throw new ApiError(
      'internalError',
      'Conversation does not have a current revision yet.',
    )
  }

  const assets = await db
    .select()
    .from(conversationAssets)
    .where(eq(conversationAssets.revisionId, conversation.currentRevisionId))

  const canonicalAsset = assets.find(asset => asset.kind === 'canonical_json')
  const renderAsset = assets.find(asset => asset.kind === 'render_json')

  if (!canonicalAsset || !renderAsset) {
    throw new ApiError(
      'internalError',
      'The current revision is missing stored canonical or render assets.',
    )
  }

  return { conversation, canonicalAsset, renderAsset }
}

const renderArtifactPreview = (artifact: SessionArtifact): string => {
  switch (artifact.artifactType) {
    case 'plan':
      return artifact.content
    case 'question_interaction':
      return JSON.stringify(
        {
          questions: artifact.questions,
          answers: artifact.answers,
          outcome: artifact.outcome,
        },
        null,
        2,
      )
    case 'tool_output':
      return artifact.previewText ?? 'Tool output is available in the canonical session.'
    case 'todo_snapshot':
      return artifact.todos
        .map(todo => `- [${todo.status}] ${todo.content}`)
        .join('\n')
    default:
      return JSON.stringify(artifact, null, 2)
  }
}
