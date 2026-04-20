#!/usr/bin/env node
/**
 * Generate a `.changeset/*.md` file from Conventional Commits on the current branch.
 *
 * Usage:
 *   node scripts/auto-changeset.mjs                     # HEAD vs origin/main
 *   BASE_BRANCH=develop node scripts/auto-changeset.mjs
 *
 * Rules:
 * - Skips if the branch already added a changeset (README excluded).
 * - Maps changed files to deployable release surfaces via `tooling/release/surfaces.mjs`.
 * - Derives bump type from commit subjects:
 *     feat!/fix!/anything! or BREAKING CHANGE footer → major
 *     feat                                           → minor
 *     fix, perf, refactor, revert, build             → patch
 *     chore, ci, docs, style, test                   → skipped
 * - If release surfaces are touched but every commit is a "skip" type, writes an
 *   empty changeset so the release-intent check still passes.
 */

import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getChangedSurfaces, getReleaseSurface } from '../tooling/release/surfaces.mjs'

const typeRegex =
  /^(feat|fix|perf|refactor|revert|build|chore|ci|docs|style|test)(\([^)]*\))?(!)?:\s*(.+)$/
const skipTypes = new Set(['chore', 'ci', 'docs', 'style', 'test'])
const patchTypes = new Set(['fix', 'perf', 'refactor', 'revert', 'build'])
const rank = { patch: 1, minor: 2, major: 3 }

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const changesetDir = join(repoRoot, '.changeset')
const baseBranch = process.env.BASE_BRANCH || 'main'
const baseRef = `origin/${baseBranch}`

const log = (msg) => console.log(`[auto-changeset] ${msg}`)
const sh = (cmd) =>
  execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim()

export const getAddedChangesetPaths = (diffText) =>
  diffText
    .split('\n')
    .filter((filePath) => filePath && filePath.endsWith('.md') && !filePath.endsWith('README.md'))

export const getAffectedReleasePackageNames = (changedFiles) => {
  const surfaceKeys = getChangedSurfaces(changedFiles)

  return [...new Set(surfaceKeys.map((surfaceKey) => getReleaseSurface(surfaceKey).packageName))]
}

export const parseCommitLog = (commitLog) =>
  commitLog
    .split('\x1f')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [hash, subject = '', body = ''] = block.split('\x1e')
      return { hash, subject: subject.trim(), body: body.trim() }
    })

export const deriveBumpAndSummaries = (commits) => {
  let bump = null
  const summaries = []

  const lift = (level) => {
    if (!bump || rank[level] > rank[bump]) bump = level
  }

  for (const { subject, body } of commits) {
    if (!subject) continue
    const match = subject.match(typeRegex)
    const breakingFooter = /^BREAKING[- ]CHANGE:/m.test(body)

    if (!match) {
      lift('patch')
      summaries.push(subject)
      continue
    }

    const [, type, , bang, description] = match
    if (bang || breakingFooter) lift('major')
    else if (type === 'feat') lift('minor')
    else if (patchTypes.has(type)) lift('patch')
    else if (!skipTypes.has(type)) lift('patch')

    summaries.push(description)
  }

  return {
    bump,
    summaries: [...new Set(summaries)],
  }
}

export const buildChangesetMarkdown = (input) => {
  if (!input.bump) {
    return '---\n---\n\nNon-releasable changes (chore/ci/docs/style/test only).\n'
  }

  const frontmatter = input.packageNames
    .map((packageName) => `'${packageName}': ${input.bump}`)
    .join('\n')

  return [
    '---',
    frontmatter,
    '---',
    '',
    ...input.summaries.map((summary) => `- ${summary}`),
    '',
  ].join('\n')
}

const main = () => {
  const addedChangesets = getAddedChangesetPaths(
    sh(`git diff --name-only --diff-filter=A ${baseRef}...HEAD -- .changeset/`),
  )

  if (addedChangesets.length > 0) {
    log(`changeset already present: ${addedChangesets.join(', ')}`)
    return
  }

  const changedFiles = sh(`git diff --name-only ${baseRef}...HEAD`)
    .split('\n')
    .filter(Boolean)
  const affectedPackageNames = getAffectedReleasePackageNames(changedFiles)

  if (affectedPackageNames.length === 0) {
    log('no deployable release surfaces affected — nothing to generate.')
    return
  }

  const commits = parseCommitLog(
    sh(`git log --format=%H%x1e%s%x1e%b%x1f ${baseRef}..HEAD`),
  )
  const { bump, summaries } = deriveBumpAndSummaries(commits)

  if (!existsSync(changesetDir)) {
    mkdirSync(changesetDir, { recursive: true })
  }

  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const filename = `auto-${stamp}.md`
  const filepath = join(changesetDir, filename)
  const body = buildChangesetMarkdown({
    packageNames: affectedPackageNames,
    bump,
    summaries,
  })

  if (!bump) {
    log('no releasable commits — writing empty changeset.')
  }

  writeFileSync(filepath, body)
  log(`wrote ${relative(repoRoot, filepath)}`)

  if (!bump) {
    return
  }

  log(`bump: ${bump}`)
  log(`packages: ${affectedPackageNames.join(', ')}`)
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isMainModule) {
  main()
}
