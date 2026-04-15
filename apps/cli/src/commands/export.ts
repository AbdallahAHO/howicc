import { writeFile } from 'node:fs/promises'
import { inspectClaudeSession } from '../lib/claude'
import { printError, printSuccess } from '../lib/output'

type ExportFormat = 'bundle' | 'canonical' | 'render'

export const exportCommand = async (
  sessionId: string,
  options: { format?: ExportFormat; output?: string } = {},
) => {
  const result = await inspectClaudeSession(sessionId)

  if (!result) {
    printError(`Session ${sessionId} was not found in your local Claude storage.`)
    return
  }

  const format = options.format ?? 'canonical'
  const payload =
    format === 'bundle'
      ? result.bundle
      : format === 'render'
        ? result.render
        : result.canonical

  const json = JSON.stringify(payload, null, 2)

  if (options.output) {
    await writeFile(options.output, json)
    printSuccess(`Wrote ${format} export to ${options.output}`)
    return
  }

  process.stdout.write(json)
}
