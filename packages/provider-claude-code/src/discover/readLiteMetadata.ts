import { readStartAndEnd, parseJsonlText } from '../jsonl'
import { getString } from '../utils'
import { extractUserPromptPreview, pickPromptTitleCandidate } from '../parse/title'

export type ClaudeSessionLiteMetadata = {
  cwd?: string
  gitBranch?: string
  slug?: string
  firstPromptPreview?: string
}

export const readLiteMetadata = async (
  transcriptPath: string,
): Promise<ClaudeSessionLiteMetadata> => {
  const partialContent = await readStartAndEnd(transcriptPath)
  const entries = parseJsonlText(partialContent, { allowPartial: true })

  const firstPromptPreview = pickPromptTitleCandidate(
    entries.map(entry => extractUserPromptPreview(entry.raw)),
  )

  const latestMetadata = [...entries].reverse().find(entry => {
    const raw = entry.raw
    return Boolean(getString(raw.cwd) || getString(raw.gitBranch) || getString(raw.slug))
  })?.raw

  return {
    cwd: latestMetadata ? getString(latestMetadata.cwd) : undefined,
    gitBranch: latestMetadata ? getString(latestMetadata.gitBranch) : undefined,
    slug: latestMetadata ? getString(latestMetadata.slug) : undefined,
    firstPromptPreview,
  }
}
