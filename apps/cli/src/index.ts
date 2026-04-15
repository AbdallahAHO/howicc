import { Command, InvalidArgumentError } from 'commander'
import chalk from 'chalk'
import { configCommand, resetConfig, showConfig } from './commands/config'
import { exportCommand } from './commands/export'
import { inspectCommand } from './commands/inspect'
import { listCommand } from './commands/list'
import { loginCommand, logoutCommand, whoamiCommand } from './commands/login'
import { previewCommand } from './commands/preview'
import { profileCommand } from './commands/profile'
import { syncCommand } from './commands/sync'
import { cliVersion } from './version'

const program = new Command()
type ExportFormat = 'bundle' | 'canonical' | 'render'

const parsePositiveIntegerOption = (value: string) => {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError('Value must be a positive integer.')
  }

  const parsed = Number.parseInt(value, 10)

  if (parsed <= 0) {
    throw new InvalidArgumentError('Value must be a positive integer.')
  }

  return parsed
}

const parseExportFormatOption = (value: string): ExportFormat => {
  if (value === 'bundle' || value === 'canonical' || value === 'render') {
    return value
  }

  throw new InvalidArgumentError('Format must be one of: bundle, canonical, render.')
}

program
  .name('howicc')
  .description('Inspect, sync, and understand local coding-agent conversations.')
  .version(cliVersion)
  .showHelpAfterError()
  .showSuggestionAfterError()

program
  .command('config')
  .description('Configure the API and web origins used by the CLI')
  .action(configCommand)
  .addHelpText('after', `\nExamples:\n  $ howicc config\n`)

program
  .command('config:show')
  .description('Show the stored CLI configuration, auth state, and sync metadata')
  .action(showConfig)

program
  .command('config:reset')
  .description('Reset stored CLI configuration, auth, and sync metadata')
  .option('-y, --yes', 'Skip the confirmation prompt')
  .action(resetConfig)

program
  .command('login')
  .description('Open the browser-based login flow for the CLI')
  .action(loginCommand)

program
  .command('logout')
  .description('Clear the stored CLI auth token')
  .action(logoutCommand)

program
  .command('whoami')
  .description('Show the current CLI auth state and verify it against the API')
  .action(whoamiCommand)

program
  .command('list')
  .alias('ls')
  .description('Browse discovered local Claude Code sessions')
  .option('-a, --all', 'Show every discovered session instead of the default slice')
  .option('-l, --limit <number>', 'Limit the number of rows shown', parsePositiveIntegerOption)
  .option('--synced', 'Only show sessions that appear up to date locally')
  .option('--unsynced', 'Only show sessions that are new or changed since their last sync')
  .action(listCommand)
  .addHelpText(
    'after',
    `\nExamples:\n  $ howicc list\n  $ howicc list --unsynced\n  $ howicc list --all\n`,
  )

program
  .command('inspect <sessionId>')
  .description('Inspect one local Claude Code session through the canonical pipeline')
  .action(inspectCommand)

program
  .command('preview <sessionId>')
  .description('Preview privacy findings and the redacted public render output for one session')
  .action(previewCommand)

program
  .command('export <sessionId>')
  .description('Export a session as bundle, canonical, or render JSON')
  .option('-f, --format <format>', 'bundle | canonical | render', parseExportFormatOption)
  .option('-o, --output <path>', 'Write the JSON to a file instead of stdout')
  .action(exportCommand)

program
  .command('profile')
  .description('Show your AI coding profile aggregated from all local sessions')
  .action(profileCommand)

program
  .command('sync [sessionId]')
  .description('Upload local Claude Code sessions through the typed HowiCC sync pipeline')
  .option('--all', 'Sync every discovered session')
  .option('--select', 'Choose sessions interactively before uploading')
  .option('--force', 'Upload even when the local revision hash is unchanged')
  .option('--recent <number>', 'Sync the N most recent discovered sessions', parsePositiveIntegerOption)
  .option('-l, --limit <number>', 'Legacy alias for --recent', parsePositiveIntegerOption)
  .option('-y, --yes', 'Skip the final confirmation prompt')
  .action(syncCommand)
  .addHelpText(
    'after',
    `\nExamples:\n  $ howicc sync\n  $ howicc sync --select\n  $ howicc sync --recent 10\n  $ howicc sync 01HXYZABCDEF\n  $ howicc sync --all --force\n`,
  )

program.addHelpText(
  'after',
  `
Quick Start:
  $ howicc login
  $ howicc list --unsynced
  $ howicc sync
  $ howicc profile
`,
)

const printLandingScreen = () => {
  const dim = chalk.dim
  const white = chalk.white
  const cyan = chalk.cyan

  console.log()
  console.log(`  ${cyan('◆')} ${chalk.bold('HowiCC')} ${dim(`v${cliVersion}`)}`)
  console.log()
  console.log(`  ${dim('Inspect, sync, and understand your local coding-agent work.')}`)
  console.log()
  console.log(`  ${white('howicc login')}                 ${dim('Authenticate this machine')}`)
  console.log(`  ${white('howicc list --unsynced')}       ${dim('Review sessions that need attention')}`)
  console.log(`  ${white('howicc sync')}                  ${dim('Upload the most relevant sessions')}`)
  console.log(`  ${white('howicc profile')}               ${dim('See your coding dashboard')}`)
  console.log(`  ${white('howicc preview')} ${dim('<session>')}     ${dim('Review the redacted public preview')}`)
  console.log(`  ${white('howicc inspect')} ${dim('<session>')}     ${dim('Deep-dive into one local session')}`)
  console.log()
  console.log(`  ${dim('Run')} ${white('howicc <command> --help')} ${dim('for command details and examples.')}`)
  console.log()
}

if (process.argv.slice(2).length === 0) {
  printLandingScreen()
} else {
  program.parse()
}
