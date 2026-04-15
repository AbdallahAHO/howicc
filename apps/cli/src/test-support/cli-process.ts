import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export type CliRunResult = {
  code: number
  stdout: string
  stderr: string
}

export const cliSourceEntryPath = fileURLToPath(new URL('../index.ts', import.meta.url))
export const cliAppDirectory = fileURLToPath(new URL('..', import.meta.url))

export const buildCliEnvironment = (input: {
  homeDir: string
  claudeHomeDir?: string
  apiBaseUrl?: string
  webBaseUrl?: string
}): NodeJS.ProcessEnv => ({
  ...process.env,
  HOME: input.homeDir,
  USERPROFILE: input.homeDir,
  XDG_CONFIG_HOME: path.join(input.homeDir, '.config'),
  ...(input.claudeHomeDir ? { CLAUDE_CONFIG_DIR: input.claudeHomeDir } : {}),
  HOWICC_API_URL: input.apiBaseUrl ?? 'http://127.0.0.1:8787',
  HOWICC_WEB_URL: input.webBaseUrl ?? 'http://127.0.0.1:4321',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  CI: '1',
  TERM: 'dumb',
})

export const runCliProcess = async (input: {
  args: string[]
  env: NodeJS.ProcessEnv
  preloadPath?: string
  timeoutMs?: number
}): Promise<CliRunResult> => {
  const execArgs = ['--import', 'tsx']

  if (input.preloadPath) {
    execArgs.push('--import', pathToFileURL(input.preloadPath).href)
  }

  execArgs.push(cliSourceEntryPath, ...input.args)

  return runProcess(process.execPath, execArgs, {
    cwd: cliAppDirectory,
    env: input.env,
    timeoutMs: input.timeoutMs,
  })
}

export const runTsxScript = async (input: {
  scriptPath: string
  args?: string[]
  cwd?: string
  env: NodeJS.ProcessEnv
  preloadPath?: string
  timeoutMs?: number
}): Promise<CliRunResult> => {
  const execArgs = ['--import', 'tsx']

  if (input.preloadPath) {
    execArgs.push('--import', pathToFileURL(input.preloadPath).href)
  }

  execArgs.push(input.scriptPath, ...(input.args ?? []))

  return runProcess(process.execPath, execArgs, {
    cwd: input.cwd ?? cliAppDirectory,
    env: input.env,
    timeoutMs: input.timeoutMs,
  })
}

export const waitForHttpReady = async (
  url: string,
  timeoutMs: number,
) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {}

    await new Promise(resolve => {
      setTimeout(resolve, 250)
    })
  }

  throw new Error(`Timed out waiting for ${url}`)
}

export const findFreePort = async () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer()

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not determine a free local port.'))
        return
      }

      server.close(error => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })

    server.once('error', reject)
  })

export const waitForProcessExit = async (
  process: ChildProcess,
  timeoutMs: number,
) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for process exit.'))
    }, timeoutMs)

    process.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
    process.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
  })

export const terminateChildProcess = async (
  process: ChildProcess,
  timeoutMs = 5_000,
) => {
  if (process.exitCode !== null || process.signalCode !== null) {
    return
  }

  process.kill('SIGTERM')
  await waitForProcessExit(process, timeoutMs).catch(async () => {
    process.kill('SIGKILL')
    await waitForProcessExit(process, timeoutMs).catch(() => undefined)
  })
}

export const runProcess = async (
  command: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    timeoutMs?: number
  },
): Promise<CliRunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, options.timeoutMs ?? 30_000)

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString('utf8')
    })

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', code => {
      clearTimeout(timeout)

      resolve({
        code: timedOut ? 124 : code ?? 1,
        stdout: normalizeOutput(stdout),
        stderr: normalizeOutput(stderr),
      })
    })
  })

const normalizeOutput = (value: string): string =>
  value
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001B\][^\u0007]*\u0007/g, '')
    .replace(/\r/g, '')
    .replace(/[^\n]\u0008/g, '')
    .replace(/[\u0000-\u0007\u0009\u000B-\u001A\u001C-\u001F\u007F]/g, '')
    .trim()
