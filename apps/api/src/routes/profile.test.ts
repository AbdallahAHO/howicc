import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  authenticateCliToken: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getDigestCount: vi.fn(),
  getOrComputeUserProfile: vi.fn(),
  recomputeUserProfile: vi.fn(),
  getUserProfileStats: vi.fn(),
  listUserProfileActivity: vi.fn(),
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
    getUserProfileStats: mocks.getUserProfileStats,
    listUserProfileActivity: mocks.listUserProfileActivity,
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

  it('returns an empty-state envelope for stats when no digests are synced yet', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
    mocks.getDigestCount.mockResolvedValue(0)

    const response = await profileRoutes.request(
      'http://localhost/profile/stats',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      stats: null,
      digestCount: 0,
      message: 'No sessions synced yet. Use the CLI to sync your Claude Code sessions.',
    })
  })

  it('returns the stats snapshot when the user has synced sessions', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })
    mocks.getDigestCount.mockResolvedValue(3)
    mocks.getUserProfileStats.mockResolvedValue({
      digestCount: 3,
      totalSessions: 3,
      totalDurationMs: 1_234_567,
      totalCostUsd: 4.5,
      activeDays: 2,
      currentStreak: 1,
      longestStreak: 2,
      firstSessionAt: '2026-04-10T00:00:00.000Z',
      lastSessionAt: '2026-04-18T00:00:00.000Z',
    })

    const response = await profileRoutes.request(
      'http://localhost/profile/stats',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      digestCount: 3,
      stats: {
        digestCount: 3,
        totalSessions: 3,
        totalDurationMs: 1_234_567,
        totalCostUsd: 4.5,
        activeDays: 2,
        currentStreak: 1,
        longestStreak: 2,
        firstSessionAt: '2026-04-10T00:00:00.000Z',
        lastSessionAt: '2026-04-18T00:00:00.000Z',
      },
    })
  })

  it('returns a consistent 401 envelope for activity when no auth context is available', async () => {
    const response = await profileRoutes.request(
      'http://localhost/profile/activity',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'auth_required',
      error: 'Authentication required.',
    })
  })

  it('returns a page of activity items for an authenticated user', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'abdallah@example.com',
      name: 'Abdallah',
    })

    const item = {
      conversationId: 'conv_1',
      slug: 'welcome-refactor',
      title: 'Welcome refactor',
      visibility: 'private' as const,
      provider: 'claude_code' as const,
      projectKey: '-Users-abdallah-howicc',
      projectPath: '/Users/abdallah/Developer/personal/howicc',
      sessionCreatedAt: '2026-04-18T10:00:00.000Z',
      syncedAt: '2026-04-18T10:05:00.000Z',
      durationMs: 1_800_000,
      estimatedCostUsd: 1.23,
      toolRunCount: 42,
      turnCount: 14,
      messageCount: 28,
      sessionType: 'building' as const,
      hasPlan: true,
      models: ['claude-opus-4-7'],
      repository: null,
    }

    mocks.listUserProfileActivity.mockResolvedValue({
      items: [item],
      nextCursor: undefined,
      total: 1,
    })

    const response = await profileRoutes.request(
      'http://localhost/profile/activity?limit=10',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      items: [item],
      total: 1,
    })
    expect(mocks.listUserProfileActivity).toHaveBeenCalledWith(
      { env: 'runtime' },
      'user_1',
      { cursor: undefined, limit: 10 },
    )
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
