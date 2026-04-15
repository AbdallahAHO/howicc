import { and, desc, eq, isNotNull } from 'drizzle-orm'
import type { CanonicalSession, SessionArtifact } from '@howicc/canonical'
import { conversationAssets, conversationRevisions, conversations } from '@howicc/db/schema'
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
