import { readFileSync, writeFileSync } from 'node:fs'
import { getReleaseSurface } from './surfaces.mjs'

const args = process.argv.slice(2)

const getArgValue = (flag) => {
  const index = args.indexOf(flag)

  return index === -1 ? undefined : args[index + 1]
}

const surfaceKey = getArgValue('--surface')
const version = getArgValue('--version')
const outputPath = getArgValue('--output')

if (!surfaceKey || !version) {
  throw new Error('Both --surface and --version are required.')
}

const surface = getReleaseSurface(surfaceKey)
const changelogContents = readFileSync(surface.changelogPath, 'utf8')
const heading = `## ${version}`
const headingIndex = changelogContents.indexOf(heading)

let releaseNotes = `# ${surface.displayName} v${version}\n\nRelease automation did not find a matching changelog entry.\n`

if (headingIndex !== -1) {
  const sectionStart = headingIndex + heading.length
  const nextHeadingIndex = changelogContents.indexOf('\n## ', sectionStart)
  const section = changelogContents
    .slice(sectionStart, nextHeadingIndex === -1 ? undefined : nextHeadingIndex)
    .trim()

  releaseNotes = `# ${surface.displayName} v${version}\n\n${section}\n`
}

if (outputPath) {
  writeFileSync(outputPath, releaseNotes)
} else {
  process.stdout.write(releaseNotes)
}
