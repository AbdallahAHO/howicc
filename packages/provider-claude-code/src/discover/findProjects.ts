import { readdir } from 'node:fs/promises'
import { getClaudeHomeDir, getClaudeProjectsDir } from '../claudePaths'
import { pathExists } from '../fs'

export const findProjectDirectories = async (options?: {
  claudeHomeDir?: string
}): Promise<string[]> => {
  const claudeHomeDir = getClaudeHomeDir(options?.claudeHomeDir)
  const projectsDir = getClaudeProjectsDir(claudeHomeDir)

  if (!(await pathExists(projectsDir))) {
    return []
  }

  const entries = await readdir(projectsDir, { withFileTypes: true })

  return entries
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => `${projectsDir}/${entry.name}`)
}
