import { execFile as execFileCb } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { extractDigestHints } from '../parse/digestHints'

const execFile = promisify(execFileCb)
const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('extractDigestHints', () => {
  it('resolves repository ownership from the git remote of the session cwd', async () => {
    const repoDirectory = await mkdtemp(path.join(tmpdir(), 'howicc-git-'))
    tempDirectories.push(repoDirectory)

    const nestedDirectory = path.join(repoDirectory, 'packages', 'provider')
    await mkdir(nestedDirectory, { recursive: true })

    await execFile('git', ['init'], { cwd: repoDirectory })
    await execFile(
      'git',
      ['remote', 'add', 'origin', 'git@github.com:acme/howicc.git'],
      { cwd: repoDirectory },
    )

    const hints = await extractDigestHints(
      [],
      {
        inputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
      { cwd: nestedDirectory },
    )

    expect(hints.repository).toEqual({
      owner: 'acme',
      name: 'howicc',
      fullName: 'acme/howicc',
      source: 'git_remote',
    })
  })
})
