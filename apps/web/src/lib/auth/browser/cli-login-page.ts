import { authorizeCliLogin } from './actions'

const getCliLoginControls = () => {
  const button = document.getElementById('continue-cli-login')
  const status = document.getElementById('cli-auth-status')

  if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) {
    throw new Error('CLI login controls could not be initialized.')
  }

  const apiUrl = button.dataset.apiUrl
  const callbackUrl = button.dataset.callbackUrl
  const codeChallenge = button.dataset.codeChallenge
  const state = button.dataset.state

  if (!apiUrl || !callbackUrl || !codeChallenge || !state) {
    throw new Error('CLI login configuration is incomplete.')
  }

  return {
    button,
    status,
    apiUrl,
    callbackUrl,
    codeChallenge,
    state,
  }
}

export const wireCliLoginPage = () => {
  const {
    button,
    status,
    apiUrl,
    callbackUrl,
    codeChallenge,
    state,
  } = getCliLoginControls()
  let isPending = false

  const runAuthorize = async () => {
    if (isPending) {
      return
    }

    isPending = true
    button.disabled = true
    status.textContent = 'Authorizing CLI login...'

    try {
      const redirectUrl = await authorizeCliLogin({
        apiUrl,
        callbackUrl,
        codeChallenge,
        state,
      })

      window.location.href = redirectUrl
    } catch (error) {
      console.error(error)
      status.textContent =
        error instanceof Error ? error.message : 'Unable to continue CLI login.'
      button.disabled = false
      isPending = false
    }
  }

  button.addEventListener('click', () => {
    void runAuthorize()
  })

  void runAuthorize()
}
