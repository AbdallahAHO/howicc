import path from 'node:path'
import { getClaudePlansDir, getGlobalSettingsPaths, getProjectSettingsPaths } from '../claudePaths'
import { readJsonFileIfExists } from '../fs'
import { getString, isRecord } from '../utils'

type ClaudeSettings = {
  plansDirectory?: string
}

export const resolvePlansDirectory = async (input: {
  claudeHomeDir: string
  projectPath?: string
}): Promise<string> => {
  const settings = await readMergedClaudeSettings(input)

  if (settings.plansDirectory && input.projectPath) {
    return path.resolve(input.projectPath, settings.plansDirectory)
  }

  return getClaudePlansDir(input.claudeHomeDir)
}

const readMergedClaudeSettings = async (input: {
  claudeHomeDir: string
  projectPath?: string
}): Promise<ClaudeSettings> => {
  const settingsPaths = [
    ...getGlobalSettingsPaths(input.claudeHomeDir),
    ...(input.projectPath ? getProjectSettingsPaths(input.projectPath) : []),
  ]

  const settings = await Promise.all(
    settingsPaths.map(filePath => readJsonFileIfExists<unknown>(filePath)),
  )

  return settings.reduce<ClaudeSettings>((merged, current) => {
    if (!isRecord(current)) return merged

    const plansDirectory = getString(current.plansDirectory)

    return {
      ...merged,
      ...(plansDirectory ? { plansDirectory } : {}),
    }
  }, {})
}
