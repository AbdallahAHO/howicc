import path from 'node:path'
import type { DiscoveredSession, SourceBundle } from '@howicc/parser-core'
import { getClaudeHomeDir } from '../claudePaths'
import { createSourceFileDescriptor } from '../fs'
import { collectPlanFiles } from './collectPlans'
import { collectSessionSidecars } from './collectSessionSidecars'

export const buildClaudeSourceBundle = async (
  session: DiscoveredSession,
  options?: { claudeHomeDir?: string },
): Promise<SourceBundle> => {
  const claudeHomeDir = getClaudeHomeDir(options?.claudeHomeDir)
  const transcriptFile = await createSourceFileDescriptor({
    kind: 'transcript',
    absolutePath: session.transcriptPath,
    relPath: `${session.sessionId}.jsonl`,
  })

  const [sidecars, plans] = await Promise.all([
    collectSessionSidecars({
      sessionId: session.sessionId,
      transcriptPath: session.transcriptPath,
    }),
    collectPlanFiles({
      claudeHomeDir,
      projectPath: session.projectPath,
      sessionSlug: session.slug,
    }),
  ])

  return {
    kind: 'agent_source_bundle',
    version: 1,
    provider: 'claude_code',
    sessionId: session.sessionId,
    projectKey: session.projectKey,
    projectPath: session.projectPath,
    capturedAt: new Date().toISOString(),
    files: [transcriptFile, ...sidecars.files, ...plans.files],
    manifest: {
      transcript: {
        relPath: transcriptFile.relPath,
        absolutePath: transcriptFile.absolutePath,
      },
      slug: session.slug,
      cwd: session.projectPath,
      gitBranch: session.gitBranch,
      planFiles: plans.manifest,
      toolResults: sidecars.manifest.toolResults,
      subagents: sidecars.manifest.subagents,
      remoteAgents: sidecars.manifest.remoteAgents,
      warnings: compactWarnings([
        session.slug ? undefined : 'Session slug was not found in transcript metadata.',
        session.projectPath
          ? undefined
          : 'Project path could not be recovered from transcript metadata.',
      ]),
    },
  }
}

const compactWarnings = (warnings: Array<string | undefined>): string[] =>
  warnings.filter((warning): warning is string => Boolean(warning))
