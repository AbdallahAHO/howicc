import chalk from 'chalk'

const cancellationMessages = [
  'Cancelled.',
  'Stopped by user.',
  'No changes made.',
]

const isPromptCancellation = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'ExitPromptError' ||
    error.message.includes('User force closed the prompt'))

const getCancellationMessage = () =>
  cancellationMessages[Math.floor(Math.random() * cancellationMessages.length)] ?? 'Cancelled.'

export const safePrompt = async <T>(promptFn: () => Promise<T>): Promise<T> => {
  try {
    return await promptFn()
  } catch (error) {
    if (!isPromptCancellation(error)) {
      throw error
    }

    console.log()
    console.log(`  ${chalk.dim(getCancellationMessage())}`)
    console.log()
    process.exit(0)
  }
}
