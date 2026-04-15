#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

const distEntryPath = join(__dirname, '..', 'dist', 'index.cjs')
const sourceEntryPath = join(__dirname, '..', 'src', 'index.ts')

const commandArgs = existsSync(distEntryPath)
  ? [distEntryPath, ...process.argv.slice(2)]
  : [require.resolve('tsx/cli'), sourceEntryPath, ...process.argv.slice(2)]

const result = spawnSync(process.execPath, commandArgs, {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
