import path from 'node:path'
import type { SourceBundleManifest, SourceFile } from '@howicc/parser-core'
import { createSourceFileDescriptor, listFilesRecursively, pathExists, readJsonFileIfExists } from '../fs'

type SidecarCollection = {
  files: SourceFile[]
  manifest: Pick<SourceBundleManifest, 'toolResults' | 'subagents' | 'remoteAgents'>
}

export const collectSessionSidecars = async (input: {
  sessionId: string
  transcriptPath: string
}): Promise<SidecarCollection> => {
  const sessionDirectory = input.transcriptPath.replace(/\.jsonl$/, '')

  if (!(await pathExists(sessionDirectory))) {
    return {
      files: [],
      manifest: { toolResults: [], subagents: [], remoteAgents: [] },
    }
  }

  const [toolResults, subagents, remoteAgents] = await Promise.all([
    collectToolResults(sessionDirectory, input.sessionId),
    collectSubagents(sessionDirectory, input.sessionId),
    collectRemoteAgents(sessionDirectory, input.sessionId),
  ])

  return {
    files: [...toolResults.files, ...subagents.files, ...remoteAgents.files],
    manifest: {
      toolResults: toolResults.manifest,
      subagents: subagents.manifest,
      remoteAgents: remoteAgents.manifest,
    },
  }
}

const collectToolResults = async (
  sessionDirectory: string,
  sessionId: string,
): Promise<{ files: SourceFile[]; manifest: SourceBundleManifest['toolResults'] }> => {
  const toolResultsDirectory = path.join(sessionDirectory, 'tool-results')

  if (!(await pathExists(toolResultsDirectory))) {
    return { files: [], manifest: [] }
  }

  const filePaths = await listFilesRecursively(toolResultsDirectory)

  const files = await Promise.all(
    filePaths.map(filePath =>
      createSourceFileDescriptor({
        kind: 'tool_result',
        absolutePath: filePath,
        relPath: path.join(
          sessionId,
          'tool-results',
          path.relative(toolResultsDirectory, filePath),
        ),
      }),
    ),
  )

  return {
    files,
    manifest: files.map(file => ({
      relPath: file.relPath,
      absolutePath: file.absolutePath,
    })),
  }
}

const collectSubagents = async (
  sessionDirectory: string,
  sessionId: string,
): Promise<{ files: SourceFile[]; manifest: SourceBundleManifest['subagents'] }> => {
  const subagentsDirectory = path.join(sessionDirectory, 'subagents')

  if (!(await pathExists(subagentsDirectory))) {
    return { files: [], manifest: [] }
  }

  const filePaths = await listFilesRecursively(subagentsDirectory)
  const transcriptPaths = filePaths.filter(filePath => filePath.endsWith('.jsonl'))

  const files = await Promise.all(
    filePaths.map(filePath => {
      const isTranscript = filePath.endsWith('.jsonl')
      const relPath = path.join(
        sessionId,
        'subagents',
        path.relative(subagentsDirectory, filePath),
      )

      return createSourceFileDescriptor({
        kind: isTranscript ? 'subagent_transcript' : 'subagent_meta',
        absolutePath: filePath,
        relPath,
      })
    }),
  )

  const manifest = await Promise.all(
    transcriptPaths.map(async transcriptPath => {
      const baseName = path.basename(transcriptPath, '.jsonl')
      const metaPath = path.join(
        path.dirname(transcriptPath),
        `${baseName}.meta.json`,
      )
      const meta = await readJsonFileIfExists<Record<string, unknown>>(metaPath)
      const hasMeta = await pathExists(metaPath)

      return {
        agentId: baseName.replace(/^agent-/, ''),
        transcriptRelPath: path.join(
          sessionId,
          'subagents',
          path.relative(subagentsDirectory, transcriptPath),
        ),
        transcriptAbsolutePath: transcriptPath,
        metaRelPath: hasMeta
          ? path.join(
              sessionId,
              'subagents',
              path.relative(subagentsDirectory, metaPath),
            )
          : undefined,
        metaAbsolutePath: hasMeta ? metaPath : undefined,
        agentType:
          meta && typeof meta.agentType === 'string' ? meta.agentType : undefined,
        description:
          meta && typeof meta.description === 'string'
            ? meta.description
            : undefined,
      }
    }),
  )

  return { files, manifest }
}

const collectRemoteAgents = async (
  sessionDirectory: string,
  sessionId: string,
): Promise<{ files: SourceFile[]; manifest: SourceBundleManifest['remoteAgents'] }> => {
  const remoteAgentsDirectory = path.join(sessionDirectory, 'remote-agents')

  if (!(await pathExists(remoteAgentsDirectory))) {
    return { files: [], manifest: [] }
  }

  const filePaths = await listFilesRecursively(remoteAgentsDirectory)

  const files = await Promise.all(
    filePaths.map(filePath =>
      createSourceFileDescriptor({
        kind: 'remote_agent_meta',
        absolutePath: filePath,
        relPath: path.join(
          sessionId,
          'remote-agents',
          path.relative(remoteAgentsDirectory, filePath),
        ),
      }),
    ),
  )

  return {
    files,
    manifest: files.map(file => ({
      relPath: file.relPath,
      absolutePath: file.absolutePath,
    })),
  }
}
