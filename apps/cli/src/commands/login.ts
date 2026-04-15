import { CliConfigStore } from '../config/store'
import { createCliApiClient } from '../lib/api'
import { createCliAuthBridge } from '../lib/auth-bridge'
import { openExternalUrl } from '../lib/browser'
import {
  formatAbsoluteTime,
  printHint,
  printInfo,
  printKeyValue,
  printSuccess,
  printTitle,
  printWarning,
} from '../lib/output'

export const loginCommand = async () => {
  const store = new CliConfigStore()
  const api = createCliApiClient(store)
  const bridge = await createCliAuthBridge()
  const loginUrl = new URL('/cli/login', store.getWebBaseUrl())

  loginUrl.searchParams.set('callbackUrl', bridge.callbackUrl)
  loginUrl.searchParams.set('state', bridge.state)
  loginUrl.searchParams.set('codeChallenge', bridge.codeChallenge)

  printTitle('HowiCC CLI Login')

  try {
    const health = await api.health.check()
    if (health && 'status' in health) {
      printInfo(`API is reachable at ${store.getApiBaseUrl()} (${health.status})`)
    } else {
      printInfo(`API is reachable at ${store.getApiBaseUrl()}`)
    }
  } catch {
    printWarning(
      `The API at ${store.getApiBaseUrl()} could not be reached before opening the browser flow.`,
    )
  }

  printHint('If your browser does not open automatically, paste this URL into any browser:')
  console.log(`  ${loginUrl}`)
  console.log()

  try {
    try {
      await openExternalUrl(loginUrl.toString())
      printSuccess('Opened the web login flow in your browser.')
    } catch {
      printWarning('Automatic browser launch failed. Continue the login flow manually with the URL above.')
    }

    printInfo('Waiting for browser authentication to complete...')

    const code = await bridge.waitForCode()
    const result = await api.cliAuth.exchange({
      code,
      codeVerifier: bridge.codeVerifier,
    })

    if (!result) {
      throw new Error('CLI token exchange returned no payload.')
    }

    if (!result.success) {
      throw new Error(result.error)
    }

    store.setAuthToken({
      token: result.token,
      user: result.user,
    })

    const whoami = await api.cliAuth.whoami()

    if (!whoami) {
      store.clearAuthToken()
      throw new Error('CLI token verification returned no payload.')
    }

    if (!whoami.success) {
      store.clearAuthToken()
      throw new Error(whoami.error)
    }

    printSuccess(`Signed in as ${whoami.user.email}`)
    printHint('Run `howicc whoami` any time to verify the stored auth state.')
  } finally {
    await bridge.close()
  }
}

export const logoutCommand = async () => {
  const store = new CliConfigStore()
  store.clearAuthToken()
  printSuccess('Cleared stored CLI auth token state.')
}

export const whoamiCommand = async () => {
  const store = new CliConfigStore()
  const config = store.getAll()
  const api = createCliApiClient(store)

  printTitle('HowiCC CLI Auth State')
  printKeyValue('Web URL', config.webBaseUrl)
  printKeyValue('API URL', config.apiBaseUrl)
  printKeyValue('Auth token', config.authToken ? 'configured' : 'not configured')
  printKeyValue('Stored user', config.authUserEmail ?? 'unknown')
  printKeyValue(
    'Last login',
    config.lastLoginAt ? formatAbsoluteTime(config.lastLoginAt) : 'never',
  )

  try {
    if (config.authToken) {
      const whoami = await api.cliAuth.whoami()

      if (whoami?.success) {
        printKeyValue('Verified user', whoami.user.email)
        console.log()
        return
      }
    }

    const health = await api.health.check()
    printKeyValue('API health', health && 'status' in health ? health.status : 'reachable')
  } catch {
    printWarning('API health check failed.')
  }

  console.log()

  if (!config.authToken) {
    printInfo('Run `howicc login` to start the browser-based CLI auth flow.')
    console.log()
  }
}
