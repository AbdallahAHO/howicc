import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { SourceFile, SourceFileKind } from '@howicc/parser-core'

export const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export const readJsonFileIfExists = async <T>(
  filePath: string,
): Promise<T | undefined> => {
  if (!(await pathExists(filePath))) return undefined

  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

export const readUtf8File = async (filePath: string): Promise<string> =>
  readFile(filePath, 'utf8')

export const readUtf8Preview = async (
  filePath: string,
  maxCharacters = 2048,
): Promise<string | undefined> => {
  if (!(await pathExists(filePath))) return undefined

  const content = await readFile(filePath, 'utf8')
  return content.slice(0, maxCharacters)
}

export const listFilesRecursively = async (directoryPath: string): Promise<string[]> => {
  const entries = (await readdir(directoryPath, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )

  const nested = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return listFilesRecursively(entryPath)
      }

      return [entryPath]
    }),
  )

  return nested.flat().sort((left, right) => left.localeCompare(right))
}

export const createSourceFileDescriptor = async (input: {
  kind: SourceFileKind
  absolutePath: string
  relPath: string
}): Promise<SourceFile> => {
  const fileBuffer = await readFile(input.absolutePath)
  const fileStat = await stat(input.absolutePath)
  const sha256 = createHash('sha256').update(fileBuffer).digest('hex')
  const id = createHash('sha256')
    .update(`${input.relPath}:${sha256}`)
    .digest('hex')
    .slice(0, 16)

  return {
    id,
    kind: input.kind,
    absolutePath: input.absolutePath,
    relPath: input.relPath,
    sha256,
    bytes: fileStat.size,
    mimeType: inferMimeType(input.absolutePath),
  }
}

const inferMimeType = (filePath: string): string | undefined => {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case '.json':
      return 'application/json'
    case '.jsonl':
      return 'application/x-ndjson'
    case '.md':
      return 'text/markdown'
    case '.txt':
      return 'text/plain'
    default:
      return undefined
  }
}
