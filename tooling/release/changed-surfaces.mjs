import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { releaseSurfaces, getChangedSurfaces } from './surfaces.mjs'

const args = process.argv.slice(2)

const getArgValue = (flag) => {
  const index = args.indexOf(flag)

  return index === -1 ? undefined : args[index + 1]
}

const writeGithubOutput = (name, value) => {
  const outputPath = process.env.GITHUB_OUTPUT

  if (!outputPath) {
    return
  }

  appendFileSync(outputPath, `${name}=${value}\n`)
}

const base = getArgValue('--base')
const head = getArgValue('--head')
const githubOutput = args.includes('--github-output')

if (!base || !head) {
  throw new Error('Both --base and --head are required.')
}

const diffOutput = execFileSync('git', ['diff', '--name-only', base, head], {
  encoding: 'utf8',
}).trim()

const changedFiles = diffOutput ? diffOutput.split('\n').filter(Boolean) : []
const changedSurfaces = new Set(getChangedSurfaces(changedFiles))

const payload = {
  changedFiles,
  surfaces: Object.keys(releaseSurfaces).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: changedSurfaces.has(key),
    }),
    {},
  ),
}

if (githubOutput) {
  writeGithubOutput('file_count', String(changedFiles.length))

  for (const key of Object.keys(releaseSurfaces)) {
    writeGithubOutput(key, String(changedSurfaces.has(key)))
  }
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
