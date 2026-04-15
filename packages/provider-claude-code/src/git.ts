import { execFile as execFileCb } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)

type ParsedRemoteRepository = {
  owner: string
  name: string
  fullName: string
}

export const parseRepositoryFromRemoteUrl = (
  remoteUrl: string,
): ParsedRemoteRepository | undefined => {
  const normalizedRemoteUrl = remoteUrl.trim()
  const scpLikeMatch = normalizedRemoteUrl.match(/^[^@]+@[^:]+:(.+)$/)

  if (scpLikeMatch?.[1]) {
    return parseRepositoryPath(scpLikeMatch[1])
  }

  try {
    const url = new URL(normalizedRemoteUrl)
    return parseRepositoryPath(url.pathname)
  } catch {
    return undefined
  }
}

export const resolveRepositoryFromCwd = async (cwd: string) => {
  const gitRoot = await readGitOutput(cwd, ['rev-parse', '--show-toplevel'])
  if (!gitRoot) {
    return undefined
  }

  const rootPath = await normalizePath(gitRoot)
  const remoteUrl = await readGitOutput(rootPath, ['config', '--get', 'remote.origin.url'])
  const repository = remoteUrl ? parseRepositoryFromRemoteUrl(remoteUrl) : undefined

  if (!repository) {
    return undefined
  }

  return {
    ...repository,
    rootPath,
    remoteUrl,
  }
}

const readGitOutput = async (cwd: string, args: string[]) => {
  try {
    const { stdout } = await execFile('git', ['-C', cwd, ...args], {
      timeout: 5_000,
    })
    const output = stdout.trim()
    return output.length > 0 ? output : undefined
  } catch {
    return undefined
  }
}

const normalizePath = async (value: string) => {
  try {
    return (await realpath(value)).normalize('NFC')
  } catch {
    return value.normalize('NFC')
  }
}

const parseRepositoryPath = (
  value: string,
): ParsedRemoteRepository | undefined => {
  const segments = value
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean)

  if (segments.length < 2) {
    return undefined
  }

  const owner = segments[segments.length - 2]!
  const name = segments[segments.length - 1]!

  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
  }
}
