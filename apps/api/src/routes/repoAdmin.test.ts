import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getRuntimeDatabase: vi.fn(),
  resolveRepoPermission: vi.fn(),
  permissionAtLeast: vi.fn(),
  consentIsFresh: vi.fn(),
  getRepoSettingsRow: vi.fn(),
  hideConversationFromRepo: vi.fn(),
  listHiddenConversationsForRepo: vi.fn(),
  previewAggregatedConversations: vi.fn(),
  recordConsent: vi.fn(),
  signPreviewToken: vi.fn(),
  unhideConversationFromRepo: vi.fn(),
  upsertRepoVisibility: vi.fn(),
  verifyPreviewToken: vi.fn(),
}))

vi.mock('../runtime', () => ({
  createApiRuntime: mocks.createApiRuntime,
}))

vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth')
  return {
    ...actual,
    createApiAuth: mocks.createApiAuth,
  }
})

vi.mock('../lib/runtime-resources', async () => {
  const actual = await vi.importActual('../lib/runtime-resources')
  return {
    ...actual,
    getRuntimeDatabase: mocks.getRuntimeDatabase,
  }
})

vi.mock('../lib/github-permissions', async () => {
  const actual = await vi.importActual('../lib/github-permissions')
  return {
    ...actual,
    resolveRepoPermission: mocks.resolveRepoPermission,
    permissionAtLeast: mocks.permissionAtLeast,
  }
})

vi.mock('../modules/repo-admin/service', async () => {
  const actual = await vi.importActual('../modules/repo-admin/service')
  return {
    ...actual,
    consentIsFresh: mocks.consentIsFresh,
    getRepoSettingsRow: mocks.getRepoSettingsRow,
    hideConversationFromRepo: mocks.hideConversationFromRepo,
    listHiddenConversationsForRepo: mocks.listHiddenConversationsForRepo,
    previewAggregatedConversations: mocks.previewAggregatedConversations,
    recordConsent: mocks.recordConsent,
    signPreviewToken: mocks.signPreviewToken,
    unhideConversationFromRepo: mocks.unhideConversationFromRepo,
    upsertRepoVisibility: mocks.upsertRepoVisibility,
    verifyPreviewToken: mocks.verifyPreviewToken,
  }
})

const { default: repoAdminRoutes } = await import('./repoAdmin')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  DB: {},
}

describe('repo admin routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user_1',
      },
    })
    mocks.createApiAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
    mocks.getRuntimeDatabase.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ username: 'abdallah' }],
          }),
        }),
      }),
    })
    mocks.resolveRepoPermission.mockResolvedValue('admin')
    mocks.permissionAtLeast.mockReturnValue(true)
    mocks.consentIsFresh.mockResolvedValue({ fresh: false })
    mocks.getRepoSettingsRow.mockResolvedValue({ visibility: 'public' })
    mocks.verifyPreviewToken.mockResolvedValue(true)
    mocks.upsertRepoVisibility.mockResolvedValue(
      new Date('2026-04-19T12:00:00.000Z'),
    )
    mocks.hideConversationFromRepo.mockResolvedValue({
      found: true,
      hiddenAt: new Date('2026-04-19T12:05:00.000Z'),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('allows first-time admins to change visibility while the repo is still public', async () => {
    const response = await repoAdminRoutes.request(
      'http://localhost/repo/openai/openai-node/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: 'private',
          previewToken: 'preview-token',
        }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      repository: 'openai/openai-node',
      visibility: 'private',
      updatedAt: '2026-04-19T12:00:00.000Z',
    })
    expect(mocks.consentIsFresh).not.toHaveBeenCalled()
  })

  it('still requires fresh consent before mutating a private repo', async () => {
    mocks.getRepoSettingsRow.mockResolvedValue({ visibility: 'private' })

    const response = await repoAdminRoutes.request(
      'http://localhost/repo/openai/openai-node/visibility',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: 'members',
          previewToken: 'preview-token',
        }),
      },
      runtimeEnv,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'consent_required',
      error: 'Admin must acknowledge the private-repo notice within the last 24h.',
    })
    expect(mocks.consentIsFresh).toHaveBeenCalled()
  })

  it('allows hide mutations without consent while the repo is public', async () => {
    const response = await repoAdminRoutes.request(
      'http://localhost/repo/openai/openai-node/hide/conv_1',
      { method: 'POST' },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      conversationId: 'conv_1',
      hiddenAt: '2026-04-19T12:05:00.000Z',
    })
    expect(mocks.consentIsFresh).not.toHaveBeenCalled()
  })
})
