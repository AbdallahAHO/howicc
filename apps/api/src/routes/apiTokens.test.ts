import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  authenticateCliToken: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  listUserApiTokens: vi.fn(),
  createUserApiToken: vi.fn(),
  revokeUserApiToken: vi.fn(),
}))

vi.mock('../runtime', () => ({
  createApiRuntime: mocks.createApiRuntime,
}))

vi.mock('../lib/cli-token-auth', async () => {
  const actual = await vi.importActual('../lib/cli-token-auth')
  return {
    ...actual,
    authenticateCliToken: mocks.authenticateCliToken,
  }
})

vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth')
  return {
    ...actual,
    createApiAuth: mocks.createApiAuth,
  }
})

vi.mock('../modules/api-tokens/service', async () => {
  const actual = await vi.importActual('../modules/api-tokens/service')
  return {
    ...actual,
    listUserApiTokens: mocks.listUserApiTokens,
    createUserApiToken: mocks.createUserApiToken,
    revokeUserApiToken: mocks.revokeUserApiToken,
  }
})

const { default: apiTokensRoutes } = await import('./apiTokens')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('api-tokens routes', () => {
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

  it('returns 401 when no auth context is present on GET /api-tokens', async () => {
    const response = await apiTokensRoutes.request('http://localhost/api-tokens', undefined, runtimeEnv)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'auth_required',
      error: 'Authentication required.',
    })
  })

  it('returns the caller tokens when authenticated via CLI bearer', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'a@example.com',
      name: 'A',
    })
    mocks.listUserApiTokens.mockResolvedValue([
      {
        id: 'tok_abc',
        tokenPrefix: 'hwi_deadbeef',
        createdAt: '2026-04-18T10:00:00.000Z',
      },
    ])

    const response = await apiTokensRoutes.request('http://localhost/api-tokens', undefined, runtimeEnv)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      tokens: [
        {
          id: 'tok_abc',
          tokenPrefix: 'hwi_deadbeef',
          createdAt: '2026-04-18T10:00:00.000Z',
        },
      ],
    })
  })

  it('mints a new token and returns the plaintext secret once on POST', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'a@example.com',
      name: 'A',
    })
    mocks.createUserApiToken.mockResolvedValue({
      token: {
        id: 'tok_new',
        tokenPrefix: 'hwi_newabc123',
        createdAt: '2026-04-19T00:00:00.000Z',
      },
      secret: 'hwi_newabc123deadbeefcafe',
    })

    const response = await apiTokensRoutes.request(
      'http://localhost/api-tokens',
      { method: 'POST' },
      runtimeEnv,
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      token: {
        id: 'tok_new',
        tokenPrefix: 'hwi_newabc123',
        createdAt: '2026-04-19T00:00:00.000Z',
      },
      secret: 'hwi_newabc123deadbeefcafe',
    })
  })

  it('returns 404 when revoking a token that is not owned by the caller', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'a@example.com',
      name: 'A',
    })
    mocks.revokeUserApiToken.mockResolvedValue(null)

    const response = await apiTokensRoutes.request(
      'http://localhost/api-tokens/tok_bad',
      { method: 'DELETE' },
      runtimeEnv,
    )
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'token_not_found',
      error: 'Token not found.',
    })
  })

  it('returns 200 with revokedAt when the owner revokes their token', async () => {
    mocks.authenticateCliToken.mockResolvedValue({
      id: 'user_1',
      email: 'a@example.com',
      name: 'A',
    })
    mocks.revokeUserApiToken.mockResolvedValue({
      id: 'tok_abc',
      revokedAt: '2026-04-19T01:00:00.000Z',
    })

    const response = await apiTokensRoutes.request(
      'http://localhost/api-tokens/tok_abc',
      { method: 'DELETE' },
      runtimeEnv,
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      id: 'tok_abc',
      revokedAt: '2026-04-19T01:00:00.000Z',
    })
  })
})
