import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getPublicProfile: vi.fn(),
  getCallerPublicProfile: vi.fn(),
  updateCallerPublicProfile: vi.fn(),
  recordPublicProfileView: vi.fn(),
  deriveViewerKey: vi.fn(),
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

vi.mock('../modules/public-profile/service', async () => {
  const actual = await vi.importActual('../modules/public-profile/service')
  return {
    ...actual,
    getPublicProfile: mocks.getPublicProfile,
    getCallerPublicProfile: mocks.getCallerPublicProfile,
    updateCallerPublicProfile: mocks.updateCallerPublicProfile,
    recordPublicProfileView: mocks.recordPublicProfileView,
  }
})

vi.mock('../lib/viewer-key', async () => {
  const actual = await vi.importActual('../lib/viewer-key')
  return {
    ...actual,
    deriveViewerKey: mocks.deriveViewerKey,
  }
})

const { default: publicProfileRoutes } = await import('./publicProfile')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('public profile routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
    mocks.getSession.mockResolvedValue(null)
    mocks.createApiAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
    mocks.deriveViewerKey.mockResolvedValue('viewer-key')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes the signed-in viewer user id when recording a public profile view', async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user_1',
      },
    })
    mocks.recordPublicProfileView.mockResolvedValue({
      recorded: false,
      userFound: true,
      isPublic: true,
    })

    const response = await publicProfileRoutes.request(
      'http://localhost/profile/public/abdallah/view',
      { method: 'POST' },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      recorded: false,
    })
    expect(mocks.recordPublicProfileView).toHaveBeenCalledWith(
      { env: 'runtime' },
      {
        username: 'abdallah',
        viewerKey: 'viewer-key',
        viewerUserId: 'user_1',
      },
    )
  })
})
