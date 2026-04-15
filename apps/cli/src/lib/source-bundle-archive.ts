import { readFile } from 'node:fs/promises'
import type { SourceBundle } from '@howicc/parser-core'
import { gzipBytes } from '@howicc/storage/compression'

type TarEntry = {
  path: string
  body: Uint8Array
  mode?: number
  mtime?: Date
}

export const buildSourceBundleArchive = async (
  bundle: SourceBundle,
): Promise<Uint8Array> => {
  const archiveEntries: TarEntry[] = [
    {
      path: 'manifest.json',
      body: new TextEncoder().encode(
        JSON.stringify(createSourceBundleArchiveManifest(bundle), null, 2),
      ),
      mtime: new Date(bundle.capturedAt),
    },
    ...(await Promise.all(
      bundle.files.map(async file => ({
        path: file.relPath,
        body: new Uint8Array(await readFile(file.absolutePath)),
        mtime: new Date(bundle.capturedAt),
      })),
    )),
  ]

  return gzipBytes(createTarArchive(archiveEntries))
}

/**
 * Build the manifest JSON that ships inside the source bundle archive.
 *
 * The CLI privacy pre-flight inspects this exact structure before upload so
 * sensitive local metadata gets caught before it is archived.
 */
export const createSourceBundleArchiveManifest = (bundle: SourceBundle) => ({
  kind: 'agent_source_bundle_archive',
  version: 1,
  provider: bundle.provider,
  sessionId: bundle.sessionId,
  projectKey: bundle.projectKey,
  projectPath: bundle.projectPath,
  capturedAt: bundle.capturedAt,
  files: bundle.files.map(file => ({
    id: file.id,
    relPath: file.relPath,
    kind: file.kind,
    sha256: file.sha256,
    bytes: file.bytes,
    mimeType: file.mimeType,
  })),
  manifest: {
    transcript: {
      relPath: bundle.manifest.transcript.relPath,
    },
    slug: bundle.manifest.slug,
    cwd: bundle.manifest.cwd,
    gitBranch: bundle.manifest.gitBranch,
    planFiles: bundle.manifest.planFiles.map(file => ({
      relPath: file.relPath,
      agentId: file.agentId,
    })),
    toolResults: bundle.manifest.toolResults.map(file => ({
      relPath: file.relPath,
    })),
    subagents: bundle.manifest.subagents.map(subagent => ({
      agentId: subagent.agentId,
      transcriptRelPath: subagent.transcriptRelPath,
      metaRelPath: subagent.metaRelPath,
      agentType: subagent.agentType,
      description: subagent.description,
    })),
    remoteAgents: bundle.manifest.remoteAgents.map(file => ({
      relPath: file.relPath,
    })),
    warnings: bundle.manifest.warnings,
  },
})

const createTarArchive = (entries: TarEntry[]): Uint8Array => {
  const chunks: Uint8Array[] = []

  for (const entry of entries) {
    const header = createTarHeader(entry)
    const padding = getBlockPadding(entry.body.byteLength)

    chunks.push(header, entry.body)

    if (padding > 0) {
      chunks.push(new Uint8Array(padding))
    }
  }

  chunks.push(new Uint8Array(1024))

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const archive = new Uint8Array(totalLength)

  let offset = 0
  for (const chunk of chunks) {
    archive.set(chunk, offset)
    offset += chunk.byteLength
  }

  return archive
}

const createTarHeader = (entry: TarEntry): Uint8Array => {
  const header = new Uint8Array(512)
  const { name, prefix } = splitTarPath(entry.path)
  const mtimeSeconds = Math.floor((entry.mtime ?? new Date()).getTime() / 1000)

  writeString(header, 0, name, 100)
  writeOctal(header, 100, 8, entry.mode ?? 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, entry.body.byteLength)
  writeOctal(header, 136, 12, mtimeSeconds)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  writeString(header, 257, 'ustar', 6)
  writeString(header, 263, '00', 2)
  writeString(header, 265, 'howicc', 32)
  writeString(header, 297, 'howicc', 32)
  writeString(header, 345, prefix, 155)

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeChecksum(header, checksum)

  return header
}

const splitTarPath = (value: string) => {
  if (value.length <= 100) {
    return { name: value, prefix: '' }
  }

  const segments = value.split('/')
  let prefix = ''

  while (segments.length > 1) {
    const name = segments.pop() ?? ''
    prefix = segments.join('/')

    if (name.length <= 100 && prefix.length <= 155) {
      return { name, prefix }
    }
  }

  throw new Error(`Tar archive path is too long to encode: ${value}`)
}

const getBlockPadding = (size: number) => {
  const remainder = size % 512
  return remainder === 0 ? 0 : 512 - remainder
}

const writeString = (
  buffer: Uint8Array,
  offset: number,
  value: string,
  length: number,
) => {
  const encoded = new TextEncoder().encode(value)
  buffer.set(encoded.slice(0, length), offset)
}

const writeOctal = (
  buffer: Uint8Array,
  offset: number,
  length: number,
  value: number,
) => {
  const octal = value.toString(8).padStart(length - 1, '0')
  writeString(buffer, offset, `${octal}\0`, length)
}

const writeChecksum = (buffer: Uint8Array, checksum: number) => {
  const octal = checksum.toString(8).padStart(6, '0')
  writeString(buffer, 148, `${octal}\0 `, 8)
}
