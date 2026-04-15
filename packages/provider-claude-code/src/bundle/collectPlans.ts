import path from 'node:path'
import type { SourceFile } from '@howicc/parser-core'
import { createSourceFileDescriptor, listFilesRecursively, pathExists } from '../fs'
import { resolvePlansDirectory } from './readSettings'

export const collectPlanFiles = async (input: {
  claudeHomeDir: string
  projectPath?: string
  sessionSlug?: string
}): Promise<{ files: SourceFile[]; manifest: Array<{ relPath: string; absolutePath: string; agentId?: string }> }> => {
  if (!input.sessionSlug) {
    return { files: [], manifest: [] }
  }

  const plansDirectory = await resolvePlansDirectory({
    claudeHomeDir: input.claudeHomeDir,
    projectPath: input.projectPath,
  })

  if (!(await pathExists(plansDirectory))) {
    return { files: [], manifest: [] }
  }

  const allPlanPaths = await listFilesRecursively(plansDirectory)
  const matchingPlanPaths = allPlanPaths.filter(filePath => {
    const fileName = path.basename(filePath)

    return (
      fileName === `${input.sessionSlug}.md` ||
      fileName.startsWith(`${input.sessionSlug}-agent-`)
    )
  })

  const files = await Promise.all(
    matchingPlanPaths.map(filePath =>
      createSourceFileDescriptor({
        kind: 'plan_file',
        absolutePath: filePath,
        relPath: path.join('plans', path.basename(filePath)),
      }),
    ),
  )

  return {
    files,
    manifest: files.map(file => ({
      relPath: file.relPath,
      absolutePath: file.absolutePath,
      agentId: extractAgentIdFromPlanFile(file.relPath),
    })),
  }
}

const extractAgentIdFromPlanFile = (relPath: string): string | undefined => {
  const fileName = path.basename(relPath)
  const match = fileName.match(/-agent-(.+)\.md$/)
  return match?.[1]
}
