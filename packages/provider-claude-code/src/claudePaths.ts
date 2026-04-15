import { homedir } from 'node:os'
import path from 'node:path'

export const getClaudeHomeDir = (override?: string): string =>
  override ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude')

export const getClaudeProjectsDir = (claudeHomeDir: string): string =>
  path.join(claudeHomeDir, 'projects')

export const getClaudePlansDir = (claudeHomeDir: string): string =>
  path.join(claudeHomeDir, 'plans')

export const getGlobalSettingsPaths = (claudeHomeDir: string): string[] => [
  path.join(claudeHomeDir, 'settings.json'),
  path.join(claudeHomeDir, 'settings.local.json'),
]

export const getProjectSettingsPaths = (projectPath: string): string[] => [
  path.join(projectPath, '.claude', 'settings.json'),
  path.join(projectPath, '.claude', 'settings.local.json'),
]
