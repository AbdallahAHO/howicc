import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  authenticateCliToken: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getDigestCount: vi.fn(),
  getOrComputeUserProfile: vi.fn(),
  recomputeUserProfile: vi.fn(),
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

vi.mock('../modules/profile/service', async () => {
  const actual = await vi.importActual('../modules/profile/service')
  return {
    ...actual,
    getDigestCount: mocks.getDigestCount,
    getOrComputeUserProfile: mocks.getOrComputeUserProfile,
    recomputeUserProfile: mocks.recomputeUserProfile,
  }
})

const { default: profileRoutes } = await import('./profile')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('profile routes', () => {
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

  it('returns a consistent 401 envelope when no auth context is available', async () => {
    const response = await profileRoutes.request('http://localhost/profile', undefined, runtimeEnv)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'auth_required',
      error: 'Authentication required.',
    })
  })

  it('returns an explicit empty state when the authenticated user has no digests', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
    mocks.getDigestCount.mockResolvedValue(0)

    const response = await profileRoutes.request('http://localhost/profile', undefined, runtimeEnv)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      profile: null,
      digestCount: 0,
      message: 'No sessions synced yet. Use the CLI to sync your Claude Code sessions.',
    })
  })

  it('returns a success envelope when recomputing the profile', async () => {
    const profile = { userId: 'user_1', digestCount: 3 } as never

    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user_1',
      },
    })
    mocks.recomputeUserProfile.mockResolvedValue(profile)

    const response = await profileRoutes.request(
      'http://localhost/profile/recompute',
      {
        method: 'POST',
      },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      profile,
      recomputed: true,
    })
  })
})
