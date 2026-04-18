import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api-error'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  authenticateCliToken: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getSharedRenderDocumentBySlug: vi.fn(),
  updateConversationVisibility: vi.fn(),
  listUserConversations: vi.fn(),
  getStoredRenderDocument: vi.fn(),
  getStoredArtifactPreview: vi.fn(),
}))

vi.mock('../runtime', () => ({
  createApiRuntime: mocks.createApiRuntime,
}))

vi.mock('../lib/cli-token-auth', () => ({
  authenticateCliToken: mocks.authenticateCliToken,
}))

vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth')
  return {
    ...actual,
    createApiAuth: mocks.createApiAuth,
  }
})

vi.mock('../modules/conversations/service', async () => {
  const actual = await vi.importActual('../modules/conversations/service')
  return {
    ...actual,
    getSharedRenderDocumentBySlug: mocks.getSharedRenderDocumentBySlug,
    updateConversationVisibility: mocks.updateConversationVisibility,
    listUserConversations: mocks.listUserConversations,
    getStoredRenderDocument: mocks.getStoredRenderDocument,
    getStoredArtifactPreview: mocks.getStoredArtifactPreview,
  }
})

const { default: conversationsRoutes } = await import('./conversations')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('conversations routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
    mocks.authenticateCliToken.mockResolvedValue(null)
    mocks.getSession.mockResolvedValue(null)
    mocks.createApiAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns render document + sharedMeta on GET /shared/:slug', async () => {
    mocks.getSharedRenderDocumentBySlug.mockResolvedValue({
      renderDocument: {
        kind: 'render_document',
        schemaVersion: 1,
        session: {
          sessionId: 's_1',
          title: 'Welcome refactor',
          provider: 'claude_code',
          createdAt: '2026-04-18T10:00:00.000Z',
          updatedAt: '2026-04-18T10:30:00.000Z',
          stats: { messageCount: 4, toolRunCount: 10, activityGroupCount: 2 },
        },
        blocks: [],
      },
      sharedMeta: {
        slug: 'welcome-refactor',
        conversationId: 'conv_1',
        visibility: 'public',
        ownerUserId: 'user_1',
        isOwner: false,
        updatedAt: '2026-04-18T10:30:00.000Z',
      },
    })

    const response = await conversationsRoutes.request(
      'http://localhost/shared/welcome-refactor',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      kind: 'render_document',
      session: { title: 'Welcome refactor' },
      sharedMeta: {
        slug: 'welcome-refactor',
        visibility: 'public',
        isOwner: false,
      },
    })
  })

  it('returns a 404 when the slug does not resolve', async () => {
    mocks.getSharedRenderDocumentBySlug.mockRejectedValue(
      new ApiError('conversationNotFound', 'Conversation not found.'),
    )

    const response = await conversationsRoutes.request(
      'http://localhost/shared/nonexistent',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'conversation_not_found',
      error: 'Conversation not found.',
    })
  })

  it('returns a 401 envelope when PATCH visibility is called without auth', async () => {
    const response = await conversationsRoutes.request(
      'http://localhost/conversations/conv_1/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'public' }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'auth_required',
      error: 'Authentication required.',
    })
  })

  it('returns 400 when the visibility value is not allowed', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })

    const response = await conversationsRoutes.request(
      'http://localhost/conversations/conv_1/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'bogus' }),
      },
      runtimeEnv,
    )

    // The OpenAPI auto-validator rejects the body before the handler runs.
    // We only assert the 400 status — the error envelope is whatever
    // @hono/zod-openapi emits for schema failures.
    expect(response.status).toBe(400)
  })

  it('returns 200 with the new visibility when the owner updates it', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
    mocks.updateConversationVisibility.mockResolvedValue({
      conversationId: 'conv_1',
      slug: 'welcome-refactor',
      visibility: 'public',
      updatedAt: '2026-04-18T12:00:00.000Z',
    })

    const response = await conversationsRoutes.request(
      'http://localhost/conversations/conv_1/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'public' }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      conversationId: 'conv_1',
      slug: 'welcome-refactor',
      visibility: 'public',
      updatedAt: '2026-04-18T12:00:00.000Z',
    })
    expect(mocks.updateConversationVisibility).toHaveBeenCalledWith(
      { env: 'runtime' },
      'conv_1',
      'public',
      { viewerUserId: 'user_1' },
    )
  })

  it('returns 404 when the conversation is not owned by the caller', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
    mocks.updateConversationVisibility.mockRejectedValue(
      new ApiError('conversationNotFound', 'Conversation not found.'),
    )

    const response = await conversationsRoutes.request(
      'http://localhost/conversations/conv_bad/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'unlisted' }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'conversation_not_found',
      error: 'Conversation not found.',
    })
  })
})
