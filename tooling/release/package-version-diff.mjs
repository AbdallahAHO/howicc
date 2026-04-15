import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { getReleaseSurface } from './surfaces.mjs'

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

const surfaceKey = getArgValue('--surface')
const base = getArgValue('--base')
const head = getArgValue('--head')
const githubOutput = args.includes('--github-output')

if (!surfaceKey) {
  throw new Error('--surface is required.')
}

const surface = getReleaseSurface(surfaceKey)

const readVersionAtRef = (ref) => {
  if (!ref) {
    return null
  }

  try {
    const fileContents = execFileSync('git', ['show', `${ref}:${surface.packageJsonPath}`], {
      encoding: 'utf8',
    })

    return JSON.parse(fileContents).version ?? null
  } catch {
    return null
  }
}

const currentVersion = JSON.parse(readFileSync(surface.packageJsonPath, 'utf8')).version ?? null
const previousVersion = readVersionAtRef(base)
const nextVersion = head ? readVersionAtRef(head) ?? currentVersion : currentVersion
const changed = Boolean(previousVersion && nextVersion && previousVersion !== nextVersion)

const payload = {
  changed,
  previousVersion,
  version: nextVersion,
  packageName: surface.packageName,
  packageJsonPath: surface.packageJsonPath,
  changelogPath: surface.changelogPath,
  tag: nextVersion ? `${surface.tagPrefix}${nextVersion}` : '',
  releaseName: nextVersion ? `${surface.displayName} v${nextVersion}` : surface.displayName,
}

if (githubOutput) {
  writeGithubOutput('changed', String(payload.changed))
  writeGithubOutput('previous_version', payload.previousVersion ?? '')
  writeGithubOutput('version', payload.version ?? '')
  writeGithubOutput('package_name', payload.packageName)
  writeGithubOutput('package_json_path', payload.packageJsonPath)
  writeGithubOutput('changelog_path', payload.changelogPath)
  writeGithubOutput('tag', payload.tag)
  writeGithubOutput('release_name', payload.releaseName)
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
