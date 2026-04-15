import { createBrowserApiClient } from '../../api/client'
import { createBrowserAuthClient } from '../client'

type GithubSocialSignInClient = {
  signIn: {
    social: (input: {
      provider: 'github'
      callbackURL: string
      disableRedirect: boolean
    }) => Promise<{
      data: { redirect: boolean; url?: string } | null
      error: { message?: string } | null
    }>
  }
}

type CliAuthorizeClient = {
  cliAuth: {
    authorize: (input: {
      callbackUrl: string
      codeChallenge: string
      state: string
    }) => Promise<
      | {
          success: true
          redirectUrl: string
          expiresAt: string
        }
      | {
          success: false
          code: string
          error: string
        }
      | undefined
    >
  }
}

export const startGithubSignIn = async (
  input: {
    authApiUrl: string
    callbackUrl: string
  },
  client: GithubSocialSignInClient = createBrowserAuthClient(input.authApiUrl),
) => {
  const response = await client.signIn.social({
    provider: 'github',
    callbackURL: input.callbackUrl,
    disableRedirect: true,
  })

  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  const redirectUrl = response.data?.url

  if (!redirectUrl) {
    throw new Error('GitHub redirect URL was not returned by the auth server.')
  }

  return redirectUrl
}

export const authorizeCliLogin = async (
  input: {
    apiUrl: string
    callbackUrl: string
    codeChallenge: string
    state: string
  },
  client: CliAuthorizeClient = createBrowserApiClient(input.apiUrl),
) => {
  const response = await client.cliAuth.authorize({
    callbackUrl: input.callbackUrl,
    codeChallenge: input.codeChallenge,
    state: input.state,
  })

  if (!response) {
    throw new Error('CLI auth authorize returned no payload.')
  }

  if (response.success !== true) {
    throw new Error(response.error)
  }

  if (!response.redirectUrl) {
    throw new Error('CLI auth redirect URL was not returned by the server.')
  }

  return response.redirectUrl
}
