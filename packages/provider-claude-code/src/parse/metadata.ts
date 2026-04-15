import type { CanonicalMetadata } from '@howicc/canonical'
import type { DiscoveredSession } from '@howicc/parser-core'
import type { ParsedRawEntry } from '../jsonl'
import { getCwd, getGitBranch, getSlug, getEntryTimestamp } from './raw'
import { getString } from '../utils'
import { extractSelectedPromptTitle, pickPromptTitleCandidate } from './title'

export const buildSessionMetadata = (
  entries: ParsedRawEntry[],
  selectedEntries: ParsedRawEntry[],
  session: DiscoveredSession,
): CanonicalMetadata => {
  const reversedEntries = [...entries].reverse()

  const customTitle = reversedEntries.find(entry => entry.raw.type === 'custom-title')
  const aiTitle = reversedEntries.find(entry => entry.raw.type === 'ai-title')
  const summary = reversedEntries.find(entry => entry.raw.type === 'summary')
  const tag = reversedEntries.find(entry => entry.raw.type === 'tag')
  const mode = reversedEntries.find(entry => entry.raw.type === 'mode')
  const lastPrompt = reversedEntries.find(entry => entry.raw.type === 'last-prompt')

  const timestamps = entries
    .map(getEntryTimestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort()

  const latestEntry = reversedEntries.find(
    entry => getCwd(entry) || getGitBranch(entry) || getSlug(entry),
  )

  const summaryTitle = deriveTitle(getString(summary?.raw.summary))
  const promptTitle = extractSelectedPromptTitle(selectedEntries)
  const fallbackPromptTitle = pickPromptTitleCandidate([
    getString(lastPrompt?.raw.lastPrompt),
    session.firstPromptPreview,
  ])

  // Title resolution: customTitle > aiTitle > summary > active thread prompt > prompt preview
  const resolvedTitle =
    getString(customTitle?.raw.customTitle) ??
    getString(aiTitle?.raw.aiTitle) ??
    summaryTitle ??
    promptTitle ??
    deriveTitle(fallbackPromptTitle)

  return {
    title: resolvedTitle,
    customTitle: customTitle ? getString(customTitle.raw.customTitle) : undefined,
    summary: summary ? getString(summary.raw.summary) : undefined,
    tag: tag ? getString(tag.raw.tag) : undefined,
    cwd: latestEntry ? getCwd(latestEntry) : session.projectPath,
    gitBranch: latestEntry ? getGitBranch(latestEntry) : session.gitBranch,
    createdAt: timestamps[0] ?? session.createdAt ?? session.updatedAt,
    updatedAt:
      timestamps[timestamps.length - 1] ?? session.updatedAt ?? session.createdAt,
    mode: mode ? getString(mode.raw.mode) : undefined,
  }
}

// Derive a clean title from a prompt preview — first line, truncated
const deriveTitle = (prompt: string | undefined): string | undefined => {
  if (!prompt) return undefined
  const firstLine = prompt.split('\n')[0]?.trim()
  if (!firstLine) return undefined
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
}
