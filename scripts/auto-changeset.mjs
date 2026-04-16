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
 * - Maps changed files to workspace packages via pnpm-workspace.yaml.
 * - Derives bump type from commit subjects:
 *     feat!/fix!/anything! or BREAKING CHANGE footer → major
 *     feat                                           → minor
 *     fix, perf, refactor, revert, build             → patch
 *     chore, ci, docs, style, test                   → skipped
 * - If packages are touched but every commit is a "skip" type, writes an
 *   empty changeset so the release-intent check still passes.
 */

import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const changesetDir = join(repoRoot, '.changeset')
const baseBranch = process.env.BASE_BRANCH || 'main'
const baseRef = `origin/${baseBranch}`

const log = (msg) => console.log(`[auto-changeset] ${msg}`)
const sh = (cmd) =>
  execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim()

const addedChangesets = sh(
  `git diff --name-only --diff-filter=A ${baseRef}...HEAD -- .changeset/`,
)
  .split('\n')
  .filter((f) => f && f.endsWith('.md') && !f.endsWith('README.md'))

if (addedChangesets.length > 0) {
  log(`changeset already present: ${addedChangesets.join(', ')}`)
  process.exit(0)
}

const workspaceRaw = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
const patterns = workspaceRaw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('-'))
  .map((l) => l.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, ''))

const packages = []
const registerPackage = (absDir) => {
  const pkgPath = join(absDir, 'package.json')
  if (!existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    if (!pkg.name) return
    packages.push({ name: pkg.name, dir: relative(repoRoot, absDir) })
  } catch {}
}

for (const pattern of patterns) {
  if (pattern.endsWith('/*')) {
    const parent = join(repoRoot, pattern.slice(0, -2))
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) registerPackage(join(parent, entry.name))
    }
  } else {
    registerPackage(join(repoRoot, pattern))
  }
}

// Deepest dirs first so nested workspaces (packages/ui/web) match before parents.
packages.sort((a, b) => b.dir.length - a.dir.length)

const changedFiles = sh(`git diff --name-only ${baseRef}...HEAD`)
  .split('\n')
  .filter(Boolean)

const affectedPackages = new Set()
for (const file of changedFiles) {
  for (const pkg of packages) {
    if (file === pkg.dir || file.startsWith(pkg.dir + sep)) {
      affectedPackages.add(pkg.name)
      break
    }
  }
}

if (affectedPackages.size === 0) {
  log('no workspace packages affected — nothing to generate.')
  process.exit(0)
}

const commitLog = sh(`git log --format=%H%x1e%s%x1e%b%x1f ${baseRef}..HEAD`)
const commits = commitLog
  .split('\x1f')
  .map((block) => block.trim())
  .filter(Boolean)
  .map((block) => {
    const [hash, subject = '', body = ''] = block.split('\x1e')
    return { hash, subject: subject.trim(), body: body.trim() }
  })

const typeRegex =
  /^(feat|fix|perf|refactor|revert|build|chore|ci|docs|style|test)(\([^)]*\))?(!)?:\s*(.+)$/
const skipTypes = new Set(['chore', 'ci', 'docs', 'style', 'test'])
const patchTypes = new Set(['fix', 'perf', 'refactor', 'revert', 'build'])
const rank = { patch: 1, minor: 2, major: 3 }

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

if (!existsSync(changesetDir)) mkdirSync(changesetDir, { recursive: true })

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
const filename = `auto-${stamp}.md`
const filepath = join(changesetDir, filename)

if (!bump) {
  log('no releasable commits — writing empty changeset.')
  writeFileSync(
    filepath,
    '---\n---\n\nNon-releasable changes (chore/ci/docs/style/test only).\n',
  )
  log(`wrote ${relative(repoRoot, filepath)}`)
  process.exit(0)
}

const frontmatter = [...affectedPackages].map((n) => `'${n}': ${bump}`).join('\n')
const uniqueSummaries = [...new Set(summaries)]
const body = [
  '---',
  frontmatter,
  '---',
  '',
  ...uniqueSummaries.map((s) => `- ${s}`),
  '',
].join('\n')

writeFileSync(filepath, body)
log(`wrote ${relative(repoRoot, filepath)}`)
log(`bump: ${bump}`)
log(`packages: ${[...affectedPackages].join(', ')}`)
