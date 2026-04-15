import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  getPublicRepoDigestCount: vi.fn(),
  getRepoProfile: vi.fn(),
}))

vi.mock('../runtime', () => ({
  createApiRuntime: mocks.createApiRuntime,
}))

vi.mock('../modules/profile/service', async () => {
  const actual = await vi.importActual('../modules/profile/service')
  return {
    ...actual,
    getPublicRepoDigestCount: mocks.getPublicRepoDigestCount,
    getRepoProfile: mocks.getRepoProfile,
  }
})

const { default: repoRoutes } = await import('./repo')

const runtimeEnv = {
  WEB_APP_URL: 'http://localhost:4321',
  DB: {},
}

describe('repo routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid repository identifiers with the standard error envelope', async () => {
    const response = await repoRoutes.request(
      'http://localhost/repo/openai/openai%20node',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'repo_identifier_invalid',
      error: 'Invalid repository owner or name.',
    })
  })

  it('returns an empty-state payload when no public sessions exist', async () => {
    mocks.getPublicRepoDigestCount.mockResolvedValue(0)

    const response = await repoRoutes.request(
      'http://localhost/repo/openai/openai-node',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      repository: 'openai/openai-node',
      profile: null,
      sessionCount: 0,
      message: 'No public sessions found for this repository.',
    })
  })

  it('returns the computed repository profile when public sessions exist', async () => {
    const profile = { repository: 'openai/openai-node', contributorCount: 2 } as never

    mocks.getPublicRepoDigestCount.mockResolvedValue(4)
    mocks.getRepoProfile.mockResolvedValue(profile)

    const response = await repoRoutes.request(
      'http://localhost/repo/openai/openai-node',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      repository: 'openai/openai-node',
      profile,
      sessionCount: 4,
    })
  })
})
