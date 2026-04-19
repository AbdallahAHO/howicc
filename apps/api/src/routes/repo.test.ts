import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiRuntime: vi.fn(),
  getPublicRepoDigestCount: vi.fn(),
  getRepoProfile: vi.fn(),
  getRepoSettingsRow: vi.fn(),
  createApiAuth: vi.fn(),
  resolveRepoPermission: vi.fn(),
  getRuntimeDatabase: vi.fn(),
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

vi.mock('../modules/repo-admin/service', async () => {
  const actual = await vi.importActual('../modules/repo-admin/service')
  return {
    ...actual,
    getRepoSettingsRow: mocks.getRepoSettingsRow,
  }
})

vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth')
  return {
    ...actual,
    createApiAuth: mocks.createApiAuth,
  }
})

vi.mock('../lib/github-permissions', async () => {
  const actual = await vi.importActual('../lib/github-permissions')
  return {
    ...actual,
    resolveRepoPermission: mocks.resolveRepoPermission,
  }
})

vi.mock('../lib/runtime-resources', async () => {
  const actual = await vi.importActual('../lib/runtime-resources')
  return {
    ...actual,
    getRuntimeDatabase: mocks.getRuntimeDatabase,
  }
})

const { default: repoRoutes } = await import('./repo')

const runtimeEnv = {
  WEB_APP_URL: 'http://localhost:4321',
  API_BASE_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  DB: {},
}

describe('repo routes', () => {
  beforeEach(() => {
    mocks.createApiRuntime.mockReturnValue({ env: 'runtime' })
    mocks.getRepoSettingsRow.mockResolvedValue({ visibility: 'public' })
    mocks.createApiAuth.mockReturnValue({
      api: { getSession: vi.fn().mockResolvedValue(null) },
    })
    mocks.resolveRepoPermission.mockResolvedValue('none')
    mocks.getRuntimeDatabase.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    })
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
      visibility: 'public',
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
      visibility: 'public',
    })
  })

  it('returns the members-gated empty state when repo is members-only and viewer has no access', async () => {
    mocks.getRepoSettingsRow.mockResolvedValue({ visibility: 'members' })
    mocks.resolveRepoPermission.mockResolvedValue('none')

    const response = await repoRoutes.request(
      'http://localhost/repo/openai/openai-node',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { visibility: string; profile: null }
    expect(body.visibility).toBe('members')
    expect(body.profile).toBe(null)
  })

  it('returns the private empty state with no profile when repo is private', async () => {
    mocks.getRepoSettingsRow.mockResolvedValue({ visibility: 'private' })

    const response = await repoRoutes.request(
      'http://localhost/repo/openai/openai-node',
      undefined,
      runtimeEnv,
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { visibility: string; profile: null }
    expect(body.visibility).toBe('private')
    expect(body.profile).toBe(null)
    expect(mocks.getPublicRepoDigestCount).not.toHaveBeenCalled()
  })
})
