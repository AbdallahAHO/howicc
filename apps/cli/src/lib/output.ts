import chalk from 'chalk'

const INDENT = '  '

export const printTitle = (title: string): void => {
  console.log()
  console.log(`${INDENT}${chalk.cyan('◆')} ${chalk.bold(title)}`)
  console.log()
}

export const printSection = (title: string): void => {
  console.log(`${INDENT}${chalk.bold(title)}`)
}

export const printDivider = (): void => {
  const width = Math.max(24, Math.min(72, (process.stdout.columns ?? 80) - 4))
  console.log(`${INDENT}${chalk.dim('─'.repeat(width))}`)
}

export const printKeyValue = (label: string, value: string): void => {
  console.log(`${INDENT}${chalk.dim(label.padEnd(12))} ${value}`)
}

export const printHint = (message: string): void => {
  console.log(`${INDENT}${chalk.dim(message)}`)
}

export const printInfo = (message: string): void => {
  console.log(`${INDENT}${chalk.dim(message)}`)
}

export const printSuccess = (message: string): void => {
  console.log(`${INDENT}${chalk.green('✓')} ${message}`)
}

export const printWarning = (message: string): void => {
  console.log(`${INDENT}${chalk.yellow('!')} ${message}`)
}

export const printError = (message: string): void => {
  console.error(`${INDENT}${chalk.red('✗')} ${message}`)
}

export const formatRelativeTime = (value: string | Date): string => {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  const diffMs = Math.max(0, Date.now() - timestamp)
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 5) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export const formatAbsoluteTime = (value: string | Date): string =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
