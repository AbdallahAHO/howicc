import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiTokens, cliAuthGrants, users } from '@howicc/db/schema'

const mocks = vi.hoisted(() => ({
  createD1DatabaseAdapter: vi.fn(),
  createHowiccAuth: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@howicc/db/adapters/d1', () => ({
  createD1DatabaseAdapter: mocks.createD1DatabaseAdapter,
}))

vi.mock('@howicc/auth/server', () => ({
  createHowiccAuth: mocks.createHowiccAuth,
}))

const { default: cliAuthRoutes } = await import('./cliAuth')

type MockUser = {
  id: string
  email: string
  name: string
}

type MockGrant = {
  id: string
  codeHash: string
  codeChallenge: string
  callbackUrl: string
  state: string
  userId: string
  expiresAt: Date
  consumedAt?: Date | null
  createdAt: Date
}

type MockToken = {
  id: string
  userId: string
  tokenPrefix: string
  tokenHash: string
  createdAt: Date
  revokedAt?: Date | null
}

type MockState = {
  users: MockUser[]
  grants: MockGrant[]
  tokens: MockToken[]
  consumeGrantDenied: boolean
}

const createMockDb = (state: MockState) => {
  type MockDb = {
    $client: {
      prepare: (sql: string) => {
        bind: (...params: unknown[]) => {
          sql: string
          params: unknown[]
        }
      }
      batch: (
        statements: Array<{ sql: string; params: unknown[] }>,
      ) => Promise<Array<{ success: boolean; results: Array<Record<string, unknown>> }>>
    }
    insert: (table: unknown) => {
      values: (value: MockGrant | MockToken | MockUser) => Promise<void>
    }
    select: (_fields?: unknown) => {
      from: (table: unknown) => unknown
    }
    update: (table: unknown) => {
      set: (values: Partial<MockGrant>) => {
        where: () => {
          returning: () => Promise<Array<{ id: string }>>
        }
      }
    }
  }

  const db: MockDb = {
    $client: {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({ sql, params }),
      }),
      batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
        const consumeStatement = statements[0]
        const insertStatement = statements[1]

        if (!consumeStatement || !insertStatement) {
          throw new Error('CLI auth exchange expected a consume + insert batch.')
        }

        const [consumedAtMs, grantId, expiresAtMs, codeChallenge] = consumeStatement.params
        const grant = state.grants.find(candidate => candidate.id === grantId)

        if (
          !state.consumeGrantDenied &&
          grant &&
          grant.consumedAt == null &&
          grant.expiresAt.getTime() >= Number(expiresAtMs) &&
          grant.codeChallenge === codeChallenge
        ) {
          grant.consumedAt = new Date(Number(consumedAtMs))
        }

        const [tokenId, tokenPrefix, tokenHash, createdAtMs, insertGrantId, expectedConsumedAtMs] =
          insertStatement.params

        const insertedGrant = state.grants.find(candidate => candidate.id === insertGrantId)
        const canInsert =
          insertedGrant &&
          insertedGrant.consumedAt != null &&
          insertedGrant.consumedAt.getTime() === Number(expectedConsumedAtMs)

        if (canInsert) {
          state.tokens.push({
            id: String(tokenId),
            userId: insertedGrant.userId,
            tokenPrefix: String(tokenPrefix),
            tokenHash: String(tokenHash),
            createdAt: new Date(Number(createdAtMs)),
          })
        }

        return [
          { success: true, results: [] },
          {
            success: true,
            results: canInsert ? [{ userId: insertedGrant.userId }] : [],
          },
        ]
      },
    },
    insert: (table: unknown) => ({
      values: async (value: MockGrant | MockToken | MockUser) => {
        if (table === cliAuthGrants) state.grants.push(value as MockGrant)
        if (table === apiTokens) state.tokens.push(value as MockToken)
        if (table === users) state.users.push(value as MockUser)
      },
    }),
    select: (_fields?: unknown) => ({
      from: (table: unknown) => {
        if (table === cliAuthGrants) {
          return {
            where: () => ({
              limit: async (limit: number) => state.grants.slice(0, limit),
            }),
          }
        }

        if (table === users) {
          return {
            where: () => ({
              limit: async (limit: number) => state.users.slice(0, limit),
            }),
          }
        }

        if (table === apiTokens) {
          return {
            innerJoin: () => ({
              where: () => ({
                limit: async (limit: number) =>
                  state.tokens
                    .filter(token => token.revokedAt == null)
                    .map(token => {
                      const user = state.users.find(candidate => candidate.id === token.userId)

                      return user
                        ? {
                            userId: token.userId,
                            email: user.email,
                            name: user.name,
                          }
                        : undefined
                    })
                    .filter(Boolean)
                    .slice(0, limit),
              }),
            }),
          }
        }

        throw new Error('Unexpected select table in CLI auth test.')
      },
    }),
    update: (table: unknown) => ({
      set: (values: Partial<MockGrant>) => ({
        where: () => ({
          returning: async () => {
            if (table !== cliAuthGrants || state.consumeGrantDenied) return []

            const currentGrant = state.grants.find(grant => grant.consumedAt == null)
            if (!currentGrant) return []

            Object.assign(currentGrant, values)
            return [{ id: currentGrant.id }]
          },
        }),
      }),
    }),
  }

  return db
}

const createEnv = () => ({
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
})

const createRequest = (path: string, init?: RequestInit) =>
  cliAuthRoutes.request(`http://localhost${path}`, init, createEnv())

const createPkceChallenge = (value: string) =>
  createHash('sha256').update(value).digest('base64url')

const createSha256Hex = (value: string) =>
  createHash('sha256').update(value).digest('hex')

describe('CLI auth routes', () => {
  let state: MockState

  beforeEach(() => {
    state = {
      users: [
        {
          id: 'user_1',
          email: 'abdallah.ali.hassan@gmail.com',
          name: 'Abdallah Othman',
        },
      ],
      grants: [],
      tokens: [],
      consumeGrantDenied: false,
    }

    mocks.getSession.mockReset()
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'abdallah.ali.hassan@gmail.com' },
    })
    mocks.createD1DatabaseAdapter.mockReturnValue({ db: createMockDb(state) })
    mocks.createHowiccAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects authorize requests without an authenticated browser session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = await createRequest('/cli-auth/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callbackUrl: 'http://127.0.0.1:9999/callback',
        codeChallenge: 'challenge-value-123456',
        state: 'state-value',
      }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'browser_session_required',
      error: 'You must be signed in in the browser first.',
    })
  })

  it('rejects authorize requests with a non-local callback URL', async () => {
    const response = await createRequest('/cli-auth/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callbackUrl: 'https://howi.cc/callback',
        codeChallenge: 'challenge-value-123456',
        state: 'state-value',
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_callback_invalid',
      error: 'CLI callback URL must point to localhost or 127.0.0.1.',
    })
  })

  it('creates a one-time login grant for an authenticated browser session', async () => {
    const response = await createRequest('/cli-auth/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callbackUrl: 'http://127.0.0.1:9999/callback',
        codeChallenge: 'challenge-value-123456',
        state: 'state-value',
      }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.redirectUrl).toContain('http://127.0.0.1:9999/callback?')
    expect(payload.redirectUrl).toContain('state=state-value')
    expect(state.grants).toHaveLength(1)
    expect(state.grants[0]?.codeHash).not.toBe('challenge-value-123456')
  })

  it('rejects an expired CLI auth grant during exchange', async () => {
    state.grants.push({
      id: 'grant_1',
      codeHash: 'hash',
      codeChallenge: createPkceChallenge('code-verifier'),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() - 1_000),
      createdAt: new Date(),
    })

    const response = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'one-time-code',
        codeVerifier: 'code-verifier-1234',
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_auth_grant_invalid',
      error: 'The CLI auth code is invalid or has expired.',
    })
  })

  it('rejects a consumed CLI auth grant during exchange', async () => {
    state.grants.push({
      id: 'grant_1',
      codeHash: 'hash',
      codeChallenge: createPkceChallenge('code-verifier'),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    })

    const response = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'one-time-code',
        codeVerifier: 'code-verifier-1234',
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_auth_grant_invalid',
      error: 'The CLI auth code is invalid or has expired.',
    })
  })

  it('rejects exchange requests with the wrong PKCE verifier', async () => {
    state.grants.push({
      id: 'grant_1',
      codeHash: 'hash',
      codeChallenge: createPkceChallenge('expected-code-verifier'),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    })

    const response = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'one-time-code',
        codeVerifier: 'wrong-code-verifier',
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_auth_grant_invalid',
      error: 'The CLI code verifier does not match the original challenge.',
    })
  })

  it('issues a CLI token exactly once for a valid grant exchange', async () => {
    const code = 'one-time-code'
    const codeVerifier = 'expected-code-verifier'

    state.grants.push({
      id: 'grant_1',
      codeHash: createSha256Hex(code),
      codeChallenge: createPkceChallenge(codeVerifier),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    })

    const response = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        codeVerifier,
      }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.token).toMatch(/^hwi_/)
    expect(state.tokens).toHaveLength(1)
    expect(state.grants[0]?.consumedAt).toBeInstanceOf(Date)
  })

  it('rejects replayed grant exchanges without minting a second token', async () => {
    const code = 'one-time-code'
    const codeVerifier = 'expected-code-verifier'

    state.grants.push({
      id: 'grant_1',
      codeHash: createSha256Hex(code),
      codeChallenge: createPkceChallenge(codeVerifier),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    })

    const firstResponse = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        codeVerifier,
      }),
    })

    expect(firstResponse.status).toBe(200)
    expect(state.tokens).toHaveLength(1)

    const replayResponse = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        codeVerifier,
      }),
    })

    expect(replayResponse.status).toBe(400)
    await expect(replayResponse.json()).resolves.toEqual({
      success: false,
      code: 'cli_auth_grant_invalid',
      error: 'The CLI auth code is invalid or has expired.',
    })
    expect(state.tokens).toHaveLength(1)
  })

  it('rejects exchange attempts when the grant is raced and consumed elsewhere', async () => {
    state.consumeGrantDenied = true
    state.grants.push({
      id: 'grant_1',
      codeHash: createSha256Hex('one-time-code'),
      codeChallenge: createPkceChallenge('expected-code-verifier'),
      callbackUrl: 'http://127.0.0.1:9999/callback',
      state: 'state-value',
      userId: 'user_1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    })

    const response = await createRequest('/cli-auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'one-time-code',
        codeVerifier: 'expected-code-verifier',
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_auth_grant_invalid',
      error: 'The CLI auth code is invalid or has expired.',
    })
    expect(state.tokens).toHaveLength(0)
  })

  it('rejects whoami requests with a missing bearer token', async () => {
    const response = await createRequest('/cli-auth/whoami')

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_token_invalid',
      error: 'Missing Bearer token.',
    })
  })

  it('rejects whoami requests when the token is revoked or missing', async () => {
    state.tokens.push({
      id: 'token_1',
      userId: 'user_1',
      tokenPrefix: 'hwi_local',
      tokenHash: 'hash',
      createdAt: new Date(),
      revokedAt: new Date(),
    })

    const response = await createRequest('/cli-auth/whoami', {
      headers: { Authorization: 'Bearer hwi_local_token' },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'cli_token_invalid',
      error: 'Invalid or revoked CLI token.',
    })
  })
})
