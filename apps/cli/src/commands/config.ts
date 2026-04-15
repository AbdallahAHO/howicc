import { confirm, input } from '@inquirer/prompts'
import { CliConfigStore } from '../config/store'
import { createCliApiClient } from '../lib/api'
import {
  formatAbsoluteTime,
  printHint,
  printInfo,
  printKeyValue,
  printSuccess,
  printTitle,
  printWarning,
} from '../lib/output'
import { safePrompt } from '../lib/prompt'

export const configCommand = async () => {
  const store = new CliConfigStore()

  printTitle('Configuration')
  printHint('Set the API and web origins the CLI should talk to.')

  if (process.env.HOWICC_API_URL || process.env.HOWICC_WEB_URL) {
    printWarning('Runtime environment variables will override stored values for this shell.')
    console.log()
  }

  const apiBaseUrl = await safePrompt(() =>
    input({
      message: 'API base URL',
      default: store.getApiBaseUrl(),
    }),
  )

  const webBaseUrl = await safePrompt(() =>
    input({
      message: 'Web base URL',
      default: store.getWebBaseUrl(),
    }),
  )

  store.setApiBaseUrl(apiBaseUrl)
  store.setWebBaseUrl(webBaseUrl)

  const api = createCliApiClient(store)

  try {
    const health = await api.health.check()
    if (health && 'status' in health) {
      printSuccess(`Configuration saved. API health is ${health.status}.`)
    } else {
      printSuccess('Configuration saved.')
    }
  } catch {
    printWarning('Configuration saved, but the API health check failed.')
  }

  printKeyValue('Config file', store.getPath())
  console.log()
}

export const showConfig = async () => {
  const store = new CliConfigStore()
  const config = store.getAll()
  const syncedRevisions = Object.keys(store.getSyncedRevisions()).length

  printTitle('Configuration')
  printKeyValue(
    'API URL',
    `${config.apiBaseUrl}${process.env.HOWICC_API_URL ? ' (runtime override)' : ''}`,
  )
  printKeyValue(
    'Web URL',
    `${config.webBaseUrl}${process.env.HOWICC_WEB_URL ? ' (runtime override)' : ''}`,
  )
  printKeyValue(
    'Auth',
    config.authUserEmail ? `configured as ${config.authUserEmail}` : 'not configured',
  )
  printKeyValue(
    'Last login',
    config.lastLoginAt ? formatAbsoluteTime(config.lastLoginAt) : 'never',
  )
  printKeyValue(
    'Last sync',
    config.lastSyncAt ? formatAbsoluteTime(config.lastSyncAt) : 'never',
  )
  printKeyValue(
    'Tracked syncs',
    `${syncedRevisions} revision${syncedRevisions === 1 ? '' : 's'}`,
  )
  printKeyValue('Config file', store.getPath())
  console.log()

  if (!config.authToken) {
    printInfo('Run `howicc login` to connect the CLI to your HowiCC account.')
    console.log()
  }
}

export const resetConfig = async (
  options: {
    yes?: boolean
  } = {},
) => {
  const store = new CliConfigStore()

  const shouldReset =
    options.yes ||
    await safePrompt(() =>
      confirm({
        message: 'Reset stored CLI configuration, auth, and sync state?',
        default: false,
      }),
    )

  if (!shouldReset) {
    printInfo('Cancelled.')
    return
  }

  store.reset()
  printSuccess('Configuration reset to defaults.')
  printHint('Runtime HOWICC_API_URL and HOWICC_WEB_URL overrides still apply for this shell.')
  console.log()
}
