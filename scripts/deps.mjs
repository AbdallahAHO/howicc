#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const pinnedDependencies = new Map([
  [
    'typescript',
    {
      range: '^5.9.3',
      reason: 'Upstream tools in this workspace still declare TypeScript 5.x peer ranges.',
    },
  ],
])

const pnpmEnv = {
  ...process.env,
  NODE_NO_WARNINGS: '1',
}

const packageNameKeys = ['packageName', 'name', 'package']
const versionKeys = ['current', 'wanted', 'latest']

const runPnpm = (args, { inherit = false, allowFailure = false } = {}) => {
  const result = spawnSync('pnpm', args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: pnpmEnv,
    stdio: inherit ? 'inherit' : 'pipe',
  })

  if (!inherit && result.stderr) {
    process.stderr.write(result.stderr)
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status ?? 1}`)
  }

  return result
}

const getCandidateName = (value) => {
  for (const key of packageNameKeys) {
    if (typeof value[key] === 'string' && value[key].length > 0) {
      return value[key]
    }
  }

  return null
}

const hasVersionMetadata = (value) =>
  versionKeys.some((key) => typeof value[key] === 'string' && value[key].length > 0)

const collectOutdatedEntries = (value, entries = []) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOutdatedEntries(item, entries)
    }

    return entries
  }

  if (!value || typeof value !== 'object') {
    return entries
  }

  const name = getCandidateName(value)
  if (name && hasVersionMetadata(value)) {
    entries.push({
      name,
      current: typeof value.current === 'string' ? value.current : null,
      wanted: typeof value.wanted === 'string' ? value.wanted : null,
      latest: typeof value.latest === 'string' ? value.latest : null,
    })
  }

  for (const child of Object.values(value)) {
    collectOutdatedEntries(child, entries)
  }

  return entries
}

const getOutdatedEntries = () => {
  const result = runPnpm(['outdated', '-r', '--format', 'json'], { allowFailure: true })
  if (![0, 1].includes(result.status ?? 0)) {
    throw new Error(`pnpm outdated -r --format json failed with exit code ${result.status ?? 1}`)
  }

  const stdout = result.stdout?.trim()
  if (!stdout) {
    return []
  }

  const parsed = JSON.parse(stdout)
  const entries = collectOutdatedEntries(parsed)
  const dedupedEntries = new Map()

  for (const entry of entries) {
    if (!dedupedEntries.has(entry.name)) {
      dedupedEntries.set(entry.name, entry)
    }
  }

  return [...dedupedEntries.values()].sort((left, right) => left.name.localeCompare(right.name))
}

const partitionEntries = (entries) => {
  const actionable = []
  const pinned = []

  for (const entry of entries) {
    if (pinnedDependencies.has(entry.name)) {
      pinned.push(entry)
      continue
    }

    actionable.push(entry)
  }

  return { actionable, pinned }
}

const formatVersion = (entry) => entry.latest ?? entry.wanted ?? entry.current ?? 'unknown'

const printEntries = (title, entries) => {
  if (entries.length === 0) {
    return
  }

  console.log(title)
  for (const entry of entries) {
    console.log(`- ${entry.name}: ${entry.current ?? 'unknown'} -> ${formatVersion(entry)}`)
  }
}

const printPinnedEntries = (entries) => {
  if (entries.length === 0) {
    return
  }

  console.log('Pinned updates intentionally ignored:')
  for (const entry of entries) {
    const policy = pinnedDependencies.get(entry.name)
    console.log(
      `- ${entry.name}: ${entry.current ?? 'unknown'} -> ${formatVersion(entry)} (pinned to ${policy.range}; ${policy.reason})`,
    )
  }
}

const check = () => {
  const entries = getOutdatedEntries()
  const { actionable, pinned } = partitionEntries(entries)

  if (actionable.length === 0) {
    console.log('No actionable dependency updates.')
  } else {
    printEntries('Actionable dependency updates:', actionable)
  }

  printPinnedEntries(pinned)
}

const update = () => {
  const entries = getOutdatedEntries()
  const { actionable, pinned } = partitionEntries(entries)

  if (actionable.length === 0) {
    console.log('No actionable dependency updates.')
    printPinnedEntries(pinned)
    return
  }

  printEntries('Updating dependencies:', actionable)
  printPinnedEntries(pinned)

  runPnpm(['update', '-r', '--latest', ...actionable.map((entry) => entry.name)], { inherit: true })
  runPnpm(['dedupe'], { inherit: true })
}

const command = process.argv[2]

if (command === 'check') {
  check()
} else if (command === 'update') {
  update()
} else {
  console.error('Usage: node scripts/deps.mjs <check|update>')
  process.exitCode = 1
}
