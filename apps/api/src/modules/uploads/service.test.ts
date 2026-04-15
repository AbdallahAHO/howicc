import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  conversationAssets,
  conversationRevisions,
  conversations,
  uploadSessionAssets,
  uploadSessions,
} from '@howicc/db/schema'
import { gzipJson, buildCanonicalKey, buildRenderKey, buildSourceBundleKey } from '@howicc/storage'
import { ApiError } from '../../lib/api-error'
import {
  createRevisionUploadSession,
  finalizeRevisionUpload,
  uploadRevisionAssetBytes,
} from './service'

const mocks = vi.hoisted(() => ({
  getRuntimeDatabase: vi.fn(),
  getRuntimeStorage: vi.fn(),
  upsertSessionDigest: vi.fn(),
}))

vi.mock('../../lib/runtime-resources', () => ({
  getRuntimeDatabase: mocks.getRuntimeDatabase,
  getRuntimeStorage: mocks.getRuntimeStorage,
}))

vi.mock('../profile/service', async () => {
  const actual = await vi.importActual('../profile/service')
  return {
    ...actual,
    upsertSessionDigest: mocks.upsertSessionDigest,
  }
})

type UploadSessionState = {
  id: string
  userId: string
  sourceRevisionHash: string
  status: 'draft' | 'finalized' | 'expired'
  expiresAt: Date
  finalizedAt?: Date | null
  createdAt: Date
}

type ConversationState = {
  id: string
  ownerUserId: string
  slug: string
  title: string
  visibility: 'private'
  status: 'ready' | 'draft'
  sourceApp: string
  sourceSessionId: string
  sourceProjectKey: string
  currentRevisionId?: string | null
  createdAt: Date
  updatedAt: Date
}

type RevisionState = {
  id: string
  conversationId: string
  sourceRevisionHash: string
}

type UploadSessionAssetState = {
  id: string
  uploadSessionId: string
  kind: 'source_bundle' | 'canonical_json' | 'render_json'
  storageKey: string
  sha256: string
  bytes: number
  contentType?: string | null
  uploadedAt?: Date | null
  createdAt: Date
}

type ConversationAssetState = {
  id: string
  revisionId: string
  kind: string
  storageKey: string
  sha256: string
  bytes: number
  metaJson?: string | null
}

type UploadServiceState = {
  uploadSession: UploadSessionState
  uploadAssets?: UploadSessionAssetState[]
  conversation?: ConversationState
  revision?: RevisionState
  conversationAssets?: ConversationAssetState[]
}

const createDb = (state: UploadServiceState) => ({
  select: () => ({
    from: (table: unknown) => {
      if (table === uploadSessions) {
        return {
          where: () => ({
            limit: async (_limit: number) => [state.uploadSession],
          }),
        }
      }

      if (table === conversations) {
        return {
          where: () => ({
            limit: async (_limit: number) =>
              state.conversation ? [state.conversation] : [],
          }),
        }
      }

      if (table === conversationRevisions) {
        return {
          where: () => ({
            limit: async (_limit: number) =>
              state.revision ? [state.revision] : [],
          }),
        }
      }

      if (table === uploadSessionAssets) {
        return {
          where: () => ({
            limit: async (_limit: number) => state.uploadAssets ?? [],
          }),
        }
      }

      throw new Error('Unexpected select table in uploads service test.')
    },
  }),
  update: (table: unknown) => ({
    set: (values: Partial<UploadSessionState>) => ({
      where: async () => {
        if (table === uploadSessions) {
          state.uploadSession = { ...state.uploadSession, ...values }
          return
        }

        if (table === uploadSessionAssets) {
          state.uploadAssets = (state.uploadAssets ?? []).map(asset => ({
            ...asset,
            ...values,
          }))
        }
      },
    }),
  }),
})

const createDraftSessionDb = (state: {
  uploadSessions: UploadSessionState[]
  uploadAssets: UploadSessionAssetState[]
}) => ({
  insert: (table: unknown) => ({
    values: async (
      value:
        | Record<string, unknown>
        | Record<string, unknown>[],
    ) => {
      if (table === uploadSessions) {
        state.uploadSessions.push(value as unknown as UploadSessionState)
        return
      }

      if (table === uploadSessionAssets) {
        state.uploadAssets.push(
          ...((Array.isArray(value) ? value : [value]) as unknown as UploadSessionAssetState[]),
        )
        return
      }

      throw new Error('Unexpected insert table in uploads create-session test.')
    },
  }),
})

const createFinalizeDb = (state: UploadServiceState) => ({
  select: () => ({
    from: (table: unknown) => {
      if (table === uploadSessions) {
        return {
          where: () => ({
            limit: async (_limit: number) => [state.uploadSession],
          }),
        }
      }

      if (table === uploadSessionAssets) {
        return {
          where: async () => state.uploadAssets ?? [],
        }
      }

      if (table === conversations) {
        return {
          where: () => ({
            limit: async (_limit: number) =>
              state.conversation ? [state.conversation] : [],
          }),
        }
      }

      if (table === conversationRevisions) {
        return {
          where: () => ({
            limit: async (_limit: number) =>
              state.revision ? [state.revision] : [],
          }),
        }
      }

      throw new Error('Unexpected select table in uploads finalize test.')
    },
  }),
  insert: (table: unknown) => ({
    values: async (value: Record<string, unknown>) => {
      if (table === conversations) {
        state.conversation = value as unknown as ConversationState
        return
      }

      if (table === conversationRevisions) {
        state.revision = value as unknown as RevisionState
        return
      }

      if (table === conversationAssets) {
        state.conversationAssets ??= []
        const nextAsset = value as unknown as ConversationAssetState
        const duplicate = state.conversationAssets.some(
          candidate =>
            candidate.revisionId === nextAsset.revisionId &&
            candidate.kind === nextAsset.kind,
        )

        if (duplicate) {
          throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed')
        }

        state.conversationAssets.push(nextAsset)
        return
      }

      throw new Error('Unexpected insert table in uploads finalize test.')
    },
  }),
  update: (table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      if (table === conversations) {
        return {
          where: async () => {
            state.conversation = {
              ...(state.conversation as ConversationState),
              ...values,
            }
          },
        }
      }

      if (table === uploadSessions) {
        return {
          where: () => ({
            returning: async () => {
              if (state.uploadSession.status !== 'draft') {
                return []
              }

              state.uploadSession = {
                ...state.uploadSession,
                ...values,
              } as UploadSessionState

              return [{ id: state.uploadSession.id }]
            },
          }),
        }
      }

      throw new Error('Unexpected update table in uploads finalize test.')
    },
  }),
})

const createStorage = (
  objects: Map<string, { body: ArrayBuffer; contentType?: string }>,
) => ({
  putObject: vi.fn(async (input: {
    key: string
    body: ArrayBuffer
    contentType?: string
  }) => {
    objects.set(input.key, {
      body: input.body,
      contentType: input.contentType,
    })
  }),
  getObject: vi.fn(async (key: string) => {
    const object = objects.get(key)
    if (!object) return null
    return {
      body: object.body,
      contentType: object.contentType,
    }
  }),
  deleteObject: vi.fn(async (key: string) => {
    objects.delete(key)
  }),
  exists: vi.fn(),
})

const sha256 = (value: ArrayBuffer | Uint8Array | string) =>
  createHash('sha256')
    .update(
      typeof value === 'string'
        ? value
        : value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.from(value),
    )
    .digest('hex')

const toArrayBuffer = (value: Uint8Array) =>
  value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer

const runtime = {} as never
const user = {
  id: 'user_1',
  email: 'abdallah@example.com',
  name: 'Abdallah',
}

describe('upload service', () => {
  beforeEach(() => {
    mocks.getRuntimeStorage.mockReturnValue({
      putObject: vi.fn(),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      exists: vi.fn(),
    })
    mocks.upsertSessionDigest.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a draft upload session and draft asset rows', async () => {
    const state = {
      uploadSessions: [] as UploadSessionState[],
      uploadAssets: [] as UploadSessionAssetState[],
    }

    mocks.getRuntimeDatabase.mockReturnValue(createDraftSessionDb(state))

    const result = await createRevisionUploadSession(runtime, user, {
      sourceRevisionHash: 'rev-hash',
      assets: [
        {
          kind: 'source_bundle',
          bytes: 128,
          sha256: 'hash-source',
        },
        {
          kind: 'canonical_json',
          bytes: 256,
          sha256: 'hash-canonical',
        },
      ],
    })

    expect(result.uploadId).toMatch(/^upload_/)
    expect(result.assetTargets).toEqual([
      {
        kind: 'source_bundle',
        key: `draft-uploads/${result.uploadId}/source_bundle`,
        uploadPath: `/uploads/${result.uploadId}/assets/source_bundle`,
      },
      {
        kind: 'canonical_json',
        key: `draft-uploads/${result.uploadId}/canonical_json`,
        uploadPath: `/uploads/${result.uploadId}/assets/canonical_json`,
      },
    ])
    expect(state.uploadSessions).toHaveLength(1)
    expect(state.uploadSessions[0]).toMatchObject({
      id: result.uploadId,
      userId: user.id,
      sourceRevisionHash: 'rev-hash',
      status: 'draft',
    })
    expect(state.uploadAssets).toHaveLength(2)
    expect(state.uploadAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uploadSessionId: result.uploadId,
          kind: 'source_bundle',
          storageKey: `draft-uploads/${result.uploadId}/source_bundle`,
          sha256: 'hash-source',
          bytes: 128,
          contentType: 'application/gzip',
        }),
        expect.objectContaining({
          uploadSessionId: result.uploadId,
          kind: 'canonical_json',
          storageKey: `draft-uploads/${result.uploadId}/canonical_json`,
          sha256: 'hash-canonical',
          bytes: 256,
          contentType: 'application/gzip',
        }),
      ]),
    )
  })

  it('stores uploaded draft asset bytes and marks the asset as uploaded', async () => {
    const now = new Date()
    const body = new TextEncoder().encode('bundle payload')
    const state: UploadServiceState = {
      uploadSession: {
        id: 'upload_1',
        userId: user.id,
        sourceRevisionHash: 'rev-hash',
        status: 'draft',
        expiresAt: new Date(Date.now() + 60_000),
        finalizedAt: null,
        createdAt: now,
      },
      uploadAssets: [
        {
          id: 'uasset_source',
          uploadSessionId: 'upload_1',
          kind: 'source_bundle',
          storageKey: 'draft-uploads/upload_1/source_bundle',
          sha256: sha256(body),
          bytes: body.byteLength,
          contentType: 'application/gzip',
          uploadedAt: null,
          createdAt: now,
        },
      ],
    }
    const storageObjects = new Map<string, { body: ArrayBuffer; contentType?: string }>()

    mocks.getRuntimeDatabase.mockReturnValue(createDb(state))
    mocks.getRuntimeStorage.mockReturnValue(createStorage(storageObjects))

    const result = await uploadRevisionAssetBytes(runtime, user, {
      uploadId: 'upload_1',
      kind: 'source_bundle',
      body: toArrayBuffer(body),
      contentType: 'application/gzip',
    })

    expect(result).toEqual({
      uploadId: 'upload_1',
      kind: 'source_bundle',
      key: 'draft-uploads/upload_1/source_bundle',
      bytes: body.byteLength,
      sha256: sha256(body),
    })
    expect(storageObjects.get('draft-uploads/upload_1/source_bundle')).toMatchObject({
      body: toArrayBuffer(body),
      contentType: 'application/gzip',
    })
    expect(state.uploadAssets?.[0]?.uploadedAt).toBeInstanceOf(Date)
  })

  it('returns the existing conversation and revision when finalize is retried after success', async () => {
    const state: UploadServiceState = {
      uploadSession: {
        id: 'upload_1',
        userId: user.id,
        sourceRevisionHash: 'rev-hash',
        status: 'finalized',
        expiresAt: new Date(Date.now() + 60_000),
        finalizedAt: new Date(),
        createdAt: new Date(),
      },
      conversation: {
        id: 'conv_1',
        ownerUserId: user.id,
        slug: 'session-title',
        title: 'Session title',
        visibility: 'private',
        status: 'ready',
        sourceApp: 'claude_code',
        sourceSessionId: 'session_1',
        sourceProjectKey: 'project-key',
        currentRevisionId: 'rev_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      revision: {
        id: 'rev_1',
        conversationId: 'conv_1',
        sourceRevisionHash: 'rev-hash',
      },
    }

    mocks.getRuntimeDatabase.mockReturnValue(createDb(state))

    const result = await finalizeRevisionUpload(runtime, user, {
      uploadId: 'upload_1',
      sourceRevisionHash: 'rev-hash',
      sourceApp: 'claude_code',
      sourceSessionId: 'session_1',
      sourceProjectKey: 'project-key',
      title: 'Session title',
      assets: [],
    })

    expect(result).toEqual({
      conversationId: 'conv_1',
      revisionId: 'rev_1',
    })
  })

  it('marks expired draft uploads before rejecting finalize', async () => {
    const state: UploadServiceState = {
      uploadSession: {
        id: 'upload_1',
        userId: user.id,
        sourceRevisionHash: 'rev-hash',
        status: 'draft',
        expiresAt: new Date(Date.now() - 60_000),
        finalizedAt: null,
        createdAt: new Date(),
      },
    }

    mocks.getRuntimeDatabase.mockReturnValue(createDb(state))

    await expect(
      finalizeRevisionUpload(runtime, user, {
        uploadId: 'upload_1',
        sourceRevisionHash: 'rev-hash',
        sourceApp: 'claude_code',
        sourceSessionId: 'session_1',
        sourceProjectKey: 'project-key',
        title: 'Session title',
        assets: [],
      }),
    ).rejects.toMatchObject({
      status: 410,
      message: 'The upload session has expired. Start a new sync and try again.',
    })

    expect(state.uploadSession.status).toBe('expired')
  })

  it('finalizes a draft upload without requiring db.transaction', async () => {
    const now = new Date()
    const createdAt = now.toISOString()
    const canonical = {
      kind: 'canonical_session',
      schemaVersion: 1,
      parserVersion: 'test-parser',
      provider: 'claude_code',
      source: {
        sessionId: 'session_1',
        projectKey: 'project-key',
        sourceRevisionHash: 'rev-hash',
        transcriptSha256: 'transcript-hash',
        importedAt: createdAt,
      },
      metadata: {
        title: 'Session title',
        cwd: '/tmp/project',
        createdAt,
        updatedAt: createdAt,
        gitBranch: 'main',
      },
      selection: {
        strategy: 'leaf',
        branchCount: 1,
      },
      stats: {
        visibleMessageCount: 1,
        toolRunCount: 0,
        artifactCount: 0,
        subagentCount: 0,
      },
      events: [],
      agents: [],
      assets: [],
      artifacts: [],
      searchText: 'Session title',
      providerData: {},
    } as const

    const render = {
      kind: 'render_document',
      schemaVersion: 1,
      session: {
        sessionId: 'session_1',
        title: 'Session title',
        provider: 'claude_code',
        createdAt,
        updatedAt: createdAt,
        gitBranch: 'main',
        stats: {
          messageCount: 1,
          toolRunCount: 0,
          activityGroupCount: 0,
        },
      },
      blocks: [],
    }

    const sourceBundleBody = new TextEncoder().encode('bundle').buffer
    const canonicalBody = gzipJson(canonical)
    const renderBody = gzipJson(render)

    const state: UploadServiceState = {
      uploadSession: {
        id: 'upload_1',
        userId: user.id,
        sourceRevisionHash: 'rev-hash',
        status: 'draft',
        expiresAt: new Date(Date.now() + 60_000),
        finalizedAt: null,
        createdAt: now,
      },
      uploadAssets: [
        {
          id: 'uasset_source',
          uploadSessionId: 'upload_1',
          kind: 'source_bundle',
          storageKey: 'draft-uploads/upload_1/source_bundle',
          sha256: sha256(sourceBundleBody),
          bytes: sourceBundleBody.byteLength,
          contentType: 'application/gzip',
          uploadedAt: now,
          createdAt: now,
        },
        {
          id: 'uasset_canonical',
          uploadSessionId: 'upload_1',
          kind: 'canonical_json',
          storageKey: 'draft-uploads/upload_1/canonical_json',
          sha256: sha256(canonicalBody),
          bytes: canonicalBody.byteLength,
          contentType: 'application/gzip',
          uploadedAt: now,
          createdAt: now,
        },
        {
          id: 'uasset_render',
          uploadSessionId: 'upload_1',
          kind: 'render_json',
          storageKey: 'draft-uploads/upload_1/render_json',
          sha256: sha256(renderBody),
          bytes: renderBody.byteLength,
          contentType: 'application/gzip',
          uploadedAt: now,
          createdAt: now,
        },
      ],
      conversationAssets: [],
    }

    const storageObjects = new Map<string, { body: ArrayBuffer; contentType?: string }>([
      ['draft-uploads/upload_1/source_bundle', { body: sourceBundleBody, contentType: 'application/gzip' }],
      ['draft-uploads/upload_1/canonical_json', { body: toArrayBuffer(canonicalBody), contentType: 'application/gzip' }],
      ['draft-uploads/upload_1/render_json', { body: toArrayBuffer(renderBody), contentType: 'application/gzip' }],
    ])

    mocks.getRuntimeDatabase.mockReturnValue(createFinalizeDb(state))
    mocks.getRuntimeStorage.mockReturnValue(createStorage(storageObjects))

    const result = await finalizeRevisionUpload(runtime, user, {
      uploadId: 'upload_1',
      sourceRevisionHash: 'rev-hash',
      sourceApp: 'claude_code',
      sourceSessionId: 'session_1',
      sourceProjectKey: 'project-key',
      title: 'Session title',
      assets: state.uploadAssets!.map(asset => ({
        kind: asset.kind,
        key: asset.storageKey,
        sha256: asset.sha256,
        bytes: asset.bytes,
      })),
    })

    const conversationId = state.conversation?.id
    const revisionHash = sha256('rev-hash')

    expect(result).toEqual({
      conversationId,
      revisionId: state.revision?.id,
    })
    expect(state.uploadSession.status).toBe('finalized')
    expect(state.conversation?.currentRevisionId).toBe(state.revision?.id)
    expect(state.conversationAssets).toHaveLength(3)
    expect(storageObjects.has('draft-uploads/upload_1/source_bundle')).toBe(false)
    expect(storageObjects.has(buildSourceBundleKey(conversationId!, revisionHash))).toBe(true)
    expect(storageObjects.has(buildCanonicalKey(conversationId!, revisionHash))).toBe(true)
    expect(storageObjects.has(buildRenderKey(conversationId!, revisionHash))).toBe(true)
    expect(mocks.upsertSessionDigest).toHaveBeenCalledOnce()
  })

  it('rejects asset uploads once the upload session is finalized', async () => {
    const state: UploadServiceState = {
      uploadSession: {
        id: 'upload_1',
        userId: user.id,
        sourceRevisionHash: 'rev-hash',
        status: 'finalized',
        expiresAt: new Date(Date.now() + 60_000),
        finalizedAt: new Date(),
        createdAt: new Date(),
      },
    }

    mocks.getRuntimeDatabase.mockReturnValue(createDb(state))

    await expect(
      uploadRevisionAssetBytes(runtime, user, {
        uploadId: 'upload_1',
        kind: 'source_bundle',
        body: new TextEncoder().encode('payload').buffer,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'The upload session has already been finalized.',
    })
  })
})
