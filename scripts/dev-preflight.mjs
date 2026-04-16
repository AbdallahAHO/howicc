#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DEV_PORTS = [4321, 8787, 8788, 9229, 9230]
const API_DIR = resolve(rootDir, 'apps/api')
const JOBS_DIR = resolve(rootDir, 'apps/jobs')
const WEB_DIR = resolve(rootDir, 'apps/web')
const API_DEV_VARS = resolve(API_DIR, '.dev.vars')
const API_DEV_VARS_EXAMPLE = resolve(API_DIR, '.dev.vars.example')
const JOBS_DEV_VARS = resolve(JOBS_DIR, '.dev.vars')
const JOBS_DEV_VARS_EXAMPLE = resolve(JOBS_DIR, '.dev.vars.example')
const WEB_ENV_LOCAL = resolve(WEB_DIR, '.env.local')
const WEB_ENV_EXAMPLE = resolve(WEB_DIR, '.env.example')
const D1_STATE_DIR = resolve(API_DIR, '.wrangler/state/v3/d1')

const log = {
  step: (msg) => console.log(`\x1b[36m→\x1b[0m ${msg}`),
  ok: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`),
  skip: (msg) => console.log(`\x1b[90m·\x1b[0m ${msg}`),
}

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit', ...opts })

const runSilent = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: rootDir, encoding: 'utf8', ...opts })

const freeDevPorts = () => {
  log.step('Freeing dev ports')
  const pids = new Set()
  for (const port of DEV_PORTS) {
    const result = runSilent('lsof', ['-ti', `tcp:${port}`])
    if (result.status === 0 && result.stdout.trim()) {
      for (const pid of result.stdout.trim().split('\n')) {
        pids.add({ pid: pid.trim(), port })
      }
    }
  }
  if (pids.size === 0) {
    log.skip('No dev ports in use')
    return
  }
  for (const { pid, port } of pids) {
    runSilent('kill', ['-9', pid])
    log.ok(`Killed PID ${pid} on :${port}`)
  }
}

const ensureNodeModulesFresh = () => {
  log.step('Checking dependencies')
  const lockPath = resolve(rootDir, 'pnpm-lock.yaml')
  const modulesPath = resolve(rootDir, 'node_modules/.modules.yaml')

  if (!existsSync(modulesPath)) {
    log.warn('node_modules missing — running pnpm install')
    const result = run('pnpm', ['install'])
    if (result.status !== 0) {
      throw new Error('pnpm install failed')
    }
    return
  }

  const lockMtime = statSync(lockPath).mtimeMs
  const modulesMtime = statSync(modulesPath).mtimeMs

  if (lockMtime > modulesMtime + 1000) {
    log.warn('Lockfile newer than node_modules — running pnpm install')
    const result = run('pnpm', ['install'])
    if (result.status !== 0) {
      throw new Error('pnpm install failed')
    }
    return
  }

  log.skip('Dependencies up to date')
}

const bootstrapEnvFile = ({ label, target, example, transform }) => {
  if (existsSync(target)) {
    log.skip(`${label} exists`)
    return false
  }
  if (!existsSync(example)) {
    log.warn(`${label} example missing — skipping`)
    return false
  }
  const contents = readFileSync(example, 'utf8')
  writeFileSync(target, transform ? transform(contents) : contents)
  log.ok(`Bootstrapped ${label} from example`)
  return true
}

const ensureLocalEnvFiles = () => {
  log.step('Checking local env files')

  const apiBootstrapped = bootstrapEnvFile({
    label: 'apps/api/.dev.vars',
    target: API_DEV_VARS,
    example: API_DEV_VARS_EXAMPLE,
    transform: (s) => s.replace(/^APP_ENV=.*$/m, 'APP_ENV="development"'),
  })

  const jobsBootstrapped = bootstrapEnvFile({
    label: 'apps/jobs/.dev.vars',
    target: JOBS_DEV_VARS,
    example: JOBS_DEV_VARS_EXAMPLE,
    transform: (s) => s.replace(/^APP_ENV=.*$/m, 'APP_ENV="development"'),
  })

  bootstrapEnvFile({
    label: 'apps/web/.env.local',
    target: WEB_ENV_LOCAL,
    example: WEB_ENV_EXAMPLE,
    transform: () =>
      [
        'PUBLIC_PRODUCT_NAME="HowiCC"',
        'PUBLIC_SITE_URL="http://localhost:4321"',
        'PUBLIC_API_URL="http://localhost:8787"',
        'API_SERVER_URL="http://localhost:8787"',
        '',
      ].join('\n'),
  })

  if (apiBootstrapped || jobsBootstrapped) {
    log.warn(
      'Fresh .dev.vars created — fill in GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET for OAuth',
    )
  }
}

const ensureLocalD1 = () => {
  log.step('Applying D1 migrations (idempotent)')
  const args = existsSync(D1_STATE_DIR) ? [] : []
  const result = spawnSync(
    'pnpm',
    ['--filter', '@howicc/api', 'db:migrate:local', ...args],
    { cwd: rootDir, stdio: 'inherit' },
  )
  if (result.status !== 0) {
    throw new Error('D1 migration failed')
  }
  log.ok('D1 up to date')
}

const main = () => {
  console.log('\x1b[1m▸ howicc dev preflight\x1b[0m')
  try {
    freeDevPorts()
    ensureNodeModulesFresh()
    ensureLocalEnvFiles()
    ensureLocalD1()
    console.log('\x1b[32m\x1b[1m✓ Ready\x1b[0m\n')
  } catch (err) {
    console.error(`\x1b[31m✗ ${err.message}\x1b[0m`)
    process.exit(1)
  }
}

main()
