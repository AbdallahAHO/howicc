import type { CommandInvocation } from '@howicc/canonical'

const LOCAL_COMMAND_CAVEAT_TAG = 'local-command-caveat'
const COMMAND_NAME_TAG = 'command-name'
const COMMAND_ARGS_TAG = 'command-args'
const BASH_INPUT_TAG = 'bash-input'
const LOCAL_COMMAND_STDOUT_TAG = 'local-command-stdout'
const LOCAL_COMMAND_STDERR_TAG = 'local-command-stderr'
const BASH_STDOUT_TAG = 'bash-stdout'
const BASH_STDERR_TAG = 'bash-stderr'
const TASK_NOTIFICATION_TAG = 'task-notification'
const TASK_NOTIFICATION_SUMMARY_TAG = 'summary'
const TASK_NOTIFICATION_STATUS_TAG = 'status'

type NormalizedCommandText = {
  text?: string
  commandInvocation?: CommandInvocation
  isLocalCommandCaveat: boolean
  isMachineGenerated: boolean
  machineSubtype?: 'local_command_output' | 'bash_output' | 'task_notification'
}

export const normalizeClaudeCommandText = (
  value: string | undefined,
): NormalizedCommandText => {
  const text = value?.trim()

  if (!text) {
    return { isLocalCommandCaveat: false, isMachineGenerated: false }
  }

  const localCommandCaveat = extractTag(text, LOCAL_COMMAND_CAVEAT_TAG)
  if (localCommandCaveat) {
    return {
      text: sanitizeStructuredText(localCommandCaveat),
      isLocalCommandCaveat: true,
      isMachineGenerated: true,
    }
  }

  const taskNotification = extractTag(text, TASK_NOTIFICATION_TAG)
  if (taskNotification !== undefined) {
    const summary = sanitizeStructuredText(
      extractTag(taskNotification, TASK_NOTIFICATION_SUMMARY_TAG),
    )
    const status = sanitizeStructuredText(
      extractTag(taskNotification, TASK_NOTIFICATION_STATUS_TAG),
    )

    return {
      text: summary ?? (status ? `Background task ${status}` : 'Background task notification'),
      isLocalCommandCaveat: false,
      isMachineGenerated: true,
      machineSubtype: 'task_notification',
    }
  }

  const bashInput = extractTag(text, BASH_INPUT_TAG)
  if (bashInput) {
    const command = sanitizeStructuredText(bashInput)

    return {
      text: command ? `! ${command}` : undefined,
      commandInvocation: command
        ? {
            kind: 'bash_input',
            command,
          }
        : undefined,
      isLocalCommandCaveat: false,
      isMachineGenerated: false,
    }
  }

  const slashName = extractTag(text, COMMAND_NAME_TAG)
  if (slashName) {
    const normalizedSlashName = sanitizeStructuredText(slashName)
    const args = sanitizeStructuredText(extractTag(text, COMMAND_ARGS_TAG))

    return {
      text: args ? `${normalizedSlashName} ${args}` : normalizedSlashName,
      commandInvocation: normalizedSlashName
        ? {
            kind: 'slash_command',
            name: normalizedSlashName.replace(/^\//, ''),
            slashName: normalizedSlashName,
            args: args || undefined,
          }
        : undefined,
      isLocalCommandCaveat: false,
      isMachineGenerated: false,
    }
  }

  if (hasAnyTag(text, [LOCAL_COMMAND_STDOUT_TAG, LOCAL_COMMAND_STDERR_TAG])) {
    return {
      text: formatTaggedOutput({
        stdout: extractTag(text, LOCAL_COMMAND_STDOUT_TAG),
        stderr: extractTag(text, LOCAL_COMMAND_STDERR_TAG),
        emptyText: '(Command completed with no output)',
      }),
      isLocalCommandCaveat: false,
      isMachineGenerated: true,
      machineSubtype: 'local_command_output',
    }
  }

  if (hasAnyTag(text, [BASH_STDOUT_TAG, BASH_STDERR_TAG])) {
    return {
      text: formatTaggedOutput({
        stdout: extractTag(text, BASH_STDOUT_TAG),
        stderr: extractTag(text, BASH_STDERR_TAG),
        emptyText: '(Bash completed with no output)',
      }),
      isLocalCommandCaveat: false,
      isMachineGenerated: true,
      machineSubtype: 'bash_output',
    }
  }

  return {
    text,
    isLocalCommandCaveat: false,
    isMachineGenerated: false,
  }
}

const extractTag = (value: string, tagName: string): string | undefined => {
  const match = value.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1]?.trim()
}

const collapseWhitespace = (value: string | undefined): string | undefined =>
  value?.replace(/\s+/g, ' ').trim() || undefined

const hasAnyTag = (value: string, tagNames: string[]): boolean =>
  tagNames.some(tagName =>
    new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'i').test(value),
  )

const sanitizeStructuredText = (value: string | undefined): string | undefined =>
  collapseWhitespace(stripAnsi(value))

const sanitizeOutputText = (value: string | undefined): string | undefined =>
  stripAnsi(value)
    ?.replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && index < lines.length - 1))
    .join('\n')
    .trim() || undefined

const formatTaggedOutput = (input: {
  stdout?: string
  stderr?: string
  emptyText: string
}): string => {
  const stdout = sanitizeOutputText(input.stdout)
  const stderr = sanitizeOutputText(input.stderr)

  if (stdout && stderr) {
    return stdout === stderr ? stdout : `${stdout}\n${stderr}`
  }

  return stdout ?? stderr ?? input.emptyText
}

const stripAnsi = (value: string | undefined): string | undefined =>
  value?.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
