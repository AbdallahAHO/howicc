import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SourceBundle } from '@howicc/parser-core'
import { gunzipBytes } from '@howicc/storage/compression'
import { buildSourceBundleArchive } from './source-bundle-archive'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('buildSourceBundleArchive', () => {
  it('creates a gzipped tar archive with the manifest and source files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'howicc-source-bundle-'))
    tempDirectories.push(cwd)

    const transcriptPath = join(cwd, 'session.jsonl')
    const planPath = join(cwd, 'plans', 'plan.md')

    await writeFile(transcriptPath, '{"type":"assistant"}\n')
    await mkdir(join(cwd, 'plans'), { recursive: true })
    await writeFile(planPath, '# Plan\nship it\n')

    const bundle: SourceBundle = {
      kind: 'agent_source_bundle',
      version: 1,
      provider: 'claude_code',
      sessionId: 'session_123',
      projectKey: 'project-key',
      projectPath: cwd,
      capturedAt: '2026-04-09T15:00:00.000Z',
      files: [
        {
          id: 'file_1',
          relPath: 'session.jsonl',
          absolutePath: transcriptPath,
          kind: 'transcript',
          sha256: 'hash_1',
          bytes: 21,
        },
        {
          id: 'file_2',
          relPath: 'plans/plan.md',
          absolutePath: planPath,
          kind: 'plan_file',
          sha256: 'hash_2',
          bytes: 15,
        },
      ],
      manifest: {
        transcript: {
          relPath: 'session.jsonl',
          absolutePath: transcriptPath,
        },
        planFiles: [
          {
            relPath: 'plans/plan.md',
            absolutePath: planPath,
          },
        ],
        toolResults: [],
        subagents: [],
        remoteAgents: [],
        warnings: [],
      },
    }

    const archive = await buildSourceBundleArchive(bundle)
    const entries = extractTarEntries(gunzipBytes(archive))

    expect(entries.map(entry => entry.path)).toEqual([
      'manifest.json',
      'session.jsonl',
      'plans/plan.md',
    ])

    const manifest = JSON.parse(entries[0]!.body)

    expect(manifest.sessionId).toBe('session_123')
    expect(manifest.files).toHaveLength(2)
    expect(entries[1]!.body).toContain('{"type":"assistant"}')
    expect(entries[2]!.body).toContain('# Plan')
  })
})

const extractTarEntries = (archive: Uint8Array) => {
  const entries: Array<{ path: string; body: string }> = []
  let offset = 0

  while (offset < archive.byteLength) {
    const header = archive.slice(offset, offset + 512)

    if (header.every(byte => byte === 0)) {
      break
    }

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    const size = Number.parseInt(readTarString(header, 124, 12) || '0', 8)
    const bodyOffset = offset + 512
    const body = archive.slice(bodyOffset, bodyOffset + size)

    entries.push({
      path,
      body: new TextDecoder().decode(body),
    })

    offset = bodyOffset + size
    offset += (512 - (size % 512)) % 512
  }

  return entries
}

const readTarString = (buffer: Uint8Array, offset: number, length: number) =>
  new TextDecoder()
    .decode(buffer.slice(offset, offset + length))
    .replace(/\0.*$/, '')
    .trim()
