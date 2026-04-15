import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth')
  return {
    ...actual,
    createApiAuth: mocks.createApiAuth,
  }
})

const { default: viewerRoutes } = await import('./viewer')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('viewer routes', () => {
  beforeEach(() => {
    mocks.createApiAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a safe viewer session summary without exposing the session token', async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
      session: {
        id: 'session_1',
        userId: 'user_1',
        createdAt: '2026-04-14T12:00:00.000Z',
        updatedAt: '2026-04-14T12:00:00.000Z',
        expiresAt: '2026-04-15T12:00:00.000Z',
        token: 'secret-token',
      },
    })

    const response = await viewerRoutes.request(
      'http://localhost/viewer/session',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      authenticated: true,
      user: {
        id: 'user_1',
        email: 'abdallah@example.com',
        name: 'Abdallah',
      },
      session: {
        id: 'session_1',
        userId: 'user_1',
        createdAt: '2026-04-14T12:00:00.000Z',
        updatedAt: '2026-04-14T12:00:00.000Z',
        expiresAt: '2026-04-15T12:00:00.000Z',
      },
    })
  })

  it('returns the protected viewer HTML with a 401 when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = await viewerRoutes.request(
      'http://localhost/viewer/protected',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toContain('Access denied')
  })
})
