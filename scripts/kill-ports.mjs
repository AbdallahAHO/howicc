#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const DEV_PORTS = [4321, 8787, 8788, 9229, 9230]

const extra = process.argv
  .slice(2)
  .flatMap((arg) => arg.split(','))
  .map((arg) => Number.parseInt(arg.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0)

const ports = [...new Set([...DEV_PORTS, ...extra])]

let killed = 0
for (const port of ports) {
  const lookup = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' })
  if (lookup.status !== 0 || !lookup.stdout.trim()) continue
  for (const pid of lookup.stdout.trim().split('\n')) {
    spawnSync('kill', ['-9', pid.trim()])
    console.log(`killed PID ${pid.trim()} on :${port}`)
    killed += 1
  }
}

if (killed === 0) console.log('no dev ports in use')
