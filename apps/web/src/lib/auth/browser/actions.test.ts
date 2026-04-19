import { describe, expect, it, vi } from 'vitest'
import { authorizeCliLogin, startGithubSignIn } from './actions'

describe('browser auth actions', () => {
  it('returns the GitHub redirect URL from the auth client', async () => {
    const redirectUrl = await startGithubSignIn(
      {
        authApiUrl: 'https://api.howi.cc',
        callbackUrl: 'https://howi.cc/home',
      },
      {
        signIn: {
          social: vi.fn(async () => ({
            data: {
              redirect: false,
              url: 'https://github.com/login/oauth/authorize?client_id=test',
            },
            error: null,
          })),
        },
      },
    )

    expect(redirectUrl).toBe('https://github.com/login/oauth/authorize?client_id=test')
  })

  it('surfaces structured API errors from the CLI authorize flow', async () => {
    await expect(
      authorizeCliLogin(
        {
          apiUrl: 'https://api.howi.cc',
          callbackUrl: 'http://127.0.0.1:8787/callback',
          codeChallenge: 'challenge_1',
          state: 'state_1',
        },
        {
          cliAuth: {
            authorize: vi.fn(async () => ({
              success: false as const,
              code: 'cli_callback_invalid',
              error: 'Callback URL is invalid.',
            })),
          },
        },
      ),
    ).rejects.toThrow('Callback URL is invalid.')
  })
})
