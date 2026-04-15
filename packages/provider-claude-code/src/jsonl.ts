import { open, stat } from 'node:fs/promises'
import { readUtf8File } from './fs'
import { isRecord, type JsonRecord } from './utils'

export type ParsedRawEntry = {
  index: number
  raw: JsonRecord
}

export class JsonlParseError extends Error {
  readonly lineNumber: number
  readonly filePath?: string

  constructor(options: {
    lineNumber: number
    filePath?: string
    message: string
  }) {
    super(options.message)
    this.name = 'JsonlParseError'
    this.lineNumber = options.lineNumber
    this.filePath = options.filePath
  }
}

type ParseJsonlOptions = {
  allowPartial?: boolean
  filePath?: string
}

export const parseJsonlText = (
  content: string,
  options: ParseJsonlOptions = {},
): ParsedRawEntry[] =>
  content
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return undefined

      try {
        const parsed = JSON.parse(trimmed)

        if (!isRecord(parsed)) {
          if (options.allowPartial) {
            return undefined
          }

          throw createJsonlParseError(
            index + 1,
            options.filePath,
            'Expected a JSON object.',
          )
        }

        return { index, raw: parsed }
      } catch (error) {
        if (options.allowPartial) {
          return undefined
        }

        if (error instanceof JsonlParseError) {
          throw error
        }

        throw createJsonlParseError(
          index + 1,
          options.filePath,
          'Failed to parse JSONL.',
        )
      }
    })
    .filter((entry): entry is ParsedRawEntry => Boolean(entry))

export const parseJsonlFile = async (filePath: string): Promise<ParsedRawEntry[]> =>
  parseJsonlText(await readUtf8File(filePath), { filePath })

export const readStartAndEnd = async (
  filePath: string,
  bytes = 64 * 1024,
): Promise<string> => {
  const fileStat = await stat(filePath)

  if (fileStat.size <= bytes * 2) {
    return readUtf8File(filePath)
  }

  const fileHandle = await open(filePath, 'r')

  try {
    const headBuffer = Buffer.alloc(bytes)
    const tailBuffer = Buffer.alloc(bytes)

    await fileHandle.read(headBuffer, 0, bytes, 0)
    await fileHandle.read(tailBuffer, 0, bytes, Math.max(fileStat.size - bytes, 0))

    return `${headBuffer.toString('utf8')}\n${tailBuffer.toString('utf8')}`
  } finally {
    await fileHandle.close()
  }
}

const createJsonlParseError = (
  lineNumber: number,
  filePath: string | undefined,
  message: string,
) => {
  const location = filePath ? ` in ${filePath}` : ''
  return new JsonlParseError({
    lineNumber,
    filePath,
    message: `${message} Line ${lineNumber}${location}`,
  })
}
