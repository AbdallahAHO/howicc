import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conversations, conversationViews } from '@howicc/db/schema'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  createApiAuth: vi.fn(),
  getSession: vi.fn(),
  getRuntimeDatabase: vi.fn(),
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

vi.mock('../lib/runtime-resources', async () => {
  const actual = await vi.importActual('../lib/runtime-resources')
  return {
    ...actual,
    getRuntimeDatabase: mocks.getRuntimeDatabase,
  }
})

vi.mock('../lib/viewer-key', async () => {
  const actual = await vi.importActual('../lib/viewer-key')
  return {
    ...actual,
    deriveViewerKey: mocks.deriveViewerKey,
  }
})

const { default: viewsRoutes } = await import('./views')

const runtimeEnv = {
  APP_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-please',
  DB: {},
}

describe('views routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'viewer_1',
      },
    })
    mocks.createApiAuth.mockReturnValue({
      api: {
        getSession: mocks.getSession,
      },
    })
    mocks.deriveViewerKey.mockResolvedValue('viewer-key')

    const db = {
      select: (selection?: Record<string, unknown>) => ({
        from: (table: unknown) => {
          if (table === conversations) {
            return {
              where: () => ({
                limit: async () => [
                  {
                    id: 'conv_1',
                    ownerUserId: 'owner_1',
                    visibility: 'public',
                  },
                ],
              }),
            }
          }

          if (table === conversationViews && selection && 'count' in selection) {
            return {
              where: async () => [{ count: 0 }],
            }
          }

          if (table === conversationViews && selection && 'id' in selection) {
            return {
              where: () => ({
                limit: async () => [],
              }),
            }
          }

          throw new Error(`Unexpected table read in test: ${String(table)}`)
        },
      }),
      insert: (table: unknown) => {
        if (table !== conversationViews) {
          throw new Error(`Unexpected insert target in test: ${String(table)}`)
        }
        return {
          values: async () => undefined,
        }
      },
    }

    mocks.getRuntimeDatabase.mockReturnValue(db)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes the signed-in viewer user id into shared-session view dedup', async () => {
    const response = await viewsRoutes.request(
      'http://localhost/sessions/conv_1/view',
      { method: 'POST' },
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      recorded: true,
      viewCount: 1,
    })
    expect(mocks.deriveViewerKey).toHaveBeenCalledWith(
      expect.any(Request),
      runtimeEnv,
      'viewer_1',
    )
  })
})
