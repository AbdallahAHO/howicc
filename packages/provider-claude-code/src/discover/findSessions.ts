import path from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import type { DiscoveredSession } from '@howicc/parser-core'
import { findProjectDirectories } from './findProjects'
import { readLiteMetadata } from './readLiteMetadata'

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const discoverClaudeSessions = async (options?: {
  claudeHomeDir?: string
}): Promise<DiscoveredSession[]> => {
  const projectDirectories = await findProjectDirectories(options)

  const sessions = await Promise.all(
    projectDirectories.map(async projectDirectory => {
      const entries = await readdir(projectDirectory, { withFileTypes: true })

      const sessionFiles = entries.filter(
        entry =>
          entry.isFile() &&
          entry.name.endsWith('.jsonl') &&
          sessionIdPattern.test(entry.name.replace(/\.jsonl$/, '')),
      )

      const discovered = await Promise.all(
        sessionFiles.map(async sessionFile => {
          const transcriptPath = path.join(projectDirectory, sessionFile.name)
          const fileStat = await stat(transcriptPath)
          const metadata = await readLiteMetadata(transcriptPath)

          return {
            provider: 'claude_code' as const,
            sessionId: sessionFile.name.replace(/\.jsonl$/, ''),
            projectKey: path.basename(projectDirectory),
            projectPath: metadata.cwd,
            transcriptPath,
            createdAt: fileStat.birthtime.toISOString(),
            updatedAt: fileStat.mtime.toISOString(),
            sizeBytes: fileStat.size,
            firstPromptPreview: metadata.firstPromptPreview,
            gitBranch: metadata.gitBranch,
            slug: metadata.slug,
          } satisfies DiscoveredSession
        }),
      )

      return discovered
    }),
  )

  const latestSessions = new Map<string, DiscoveredSession>()

  for (const session of sessions.flat()) {
    const existing = latestSessions.get(session.sessionId)
    if (!existing || existing.updatedAt.localeCompare(session.updatedAt) < 0) {
      latestSessions.set(session.sessionId, session)
    }
  }

  return [...latestSessions.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}
