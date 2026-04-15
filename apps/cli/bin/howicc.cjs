#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const distEntryPath = join(__dirname, '..', 'dist', 'index.cjs')
const sourceEntryPath = join(__dirname, '..', 'src', 'index.ts')
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageVersion = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version

const commandArgs = existsSync(distEntryPath)
  ? [distEntryPath, ...process.argv.slice(2)]
  : [require.resolve('tsx/cli'), sourceEntryPath, ...process.argv.slice(2)]

const result = spawnSync(process.execPath, commandArgs, {
  env: {
    ...process.env,
    HOWICC_CLI_VERSION: packageVersion,
  },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
