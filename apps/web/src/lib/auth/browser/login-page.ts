import { startGithubSignIn } from './actions'

const getLoginControls = () => {
  const button = document.getElementById('github-sign-in')
  const status = document.getElementById('login-status')

  if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) {
    throw new Error('Login page controls could not be initialized.')
  }

  const authApiUrl = button.dataset.authApiUrl
  const callbackUrl = button.dataset.callbackUrl

  if (!authApiUrl || !callbackUrl) {
    throw new Error('Login page configuration is incomplete.')
  }

  return { button, status, authApiUrl, callbackUrl }
}

export const wireGithubLoginPage = () => {
  const { button, status, authApiUrl, callbackUrl } = getLoginControls()
  let isPending = false

  const handleClick = async () => {
    if (isPending) {
      return
    }

    isPending = true
    button.disabled = true
    status.textContent = 'Redirecting to GitHub...'

    try {
      const redirectUrl = await startGithubSignIn({
        authApiUrl,
        callbackUrl,
      })

      window.location.href = redirectUrl
    } catch (error) {
      console.error(error)
      status.textContent =
        error instanceof Error ? error.message : 'GitHub sign-in could not be started.'
      button.disabled = false
      isPending = false
    }
  }

  button.addEventListener('click', () => {
    void handleClick()
  })
}
