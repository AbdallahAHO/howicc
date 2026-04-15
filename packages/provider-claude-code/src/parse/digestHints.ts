import type { SessionDigestPrLink, SessionDigestRepository } from '@howicc/canonical'
import { normalizeMcpServerName } from '@howicc/canonical'
import { resolveRepositoryFromCwd } from '../git'
import type { ParsedRawEntry } from '../jsonl'
import { getString, isRecord, asArray } from '../utils'
import { getEntryTimestamp, getEntryType } from './raw'

type DigestHints = {
  agentVersion?: string
  mcpServersConfigured: string[]
  prLinks: SessionDigestPrLink[]
  repository?: SessionDigestRepository
  apiErrors: Array<{ type: string; count: number }>
  cacheHitRate?: number
  activeDurationMs?: number
}

/**
 * Extract CC-specific digest hints from raw JSONL entries.
 * These are data points that exist in the raw transcript but aren't
 * captured in the standard canonical event model.
 */
export const extractDigestHints = async (
  entries: ParsedRawEntry[],
  metrics: { inputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; durationMs?: number },
  options?: { cwd?: string },
): Promise<DigestHints> => {
  const agentVersion = extractAgentVersion(entries)
  const mcpServersConfigured = extractMcpServersConfigured(entries)
  const prLinks = extractPrLinks(entries)
  const repository = await resolveRepository(entries, prLinks, options?.cwd)
  const apiErrors = extractApiErrors(entries)
  const cacheHitRate = computeCacheHitRate(metrics)
  const activeDurationMs = computeActiveDuration(entries, metrics.durationMs)

  return {
    agentVersion,
    mcpServersConfigured,
    prLinks,
    repository,
    apiErrors,
    cacheHitRate,
    activeDurationMs,
  }
}

// Extract CC version from the first entry that has it
const extractAgentVersion = (entries: ParsedRawEntry[]): string | undefined => {
  for (const entry of entries) {
    const version = getString(entry.raw.version)
    if (version && version !== 'unknown') return version
  }
  return undefined
}

// Extract API-level errors (rate limit, auth failure, overloaded)
const extractApiErrors = (entries: ParsedRawEntry[]): Array<{ type: string; count: number }> => {
  const errorTypes: Record<string, number> = {}

  for (const entry of entries) {
    if (getEntryType(entry) !== 'assistant') continue
    if (entry.raw.isApiErrorMessage !== true) continue

    const errorType = getString(entry.raw.error) ?? 'unknown'
    errorTypes[errorType] = (errorTypes[errorType] ?? 0) + 1
  }

  return Object.entries(errorTypes).map(([type, count]) => ({ type, count }))
}

// Extract MCP server names from attachment entries with mcp_instructions_delta
const extractMcpServersConfigured = (entries: ParsedRawEntry[]): string[] => {
  const servers = new Set<string>()

  for (const entry of entries) {
    if (getEntryType(entry) !== 'attachment') continue

    const attachment = isRecord(entry.raw.attachment) ? entry.raw.attachment : undefined
    if (!attachment) continue

    if (getString(attachment.type) !== 'mcp_instructions_delta') continue

    const addedNames = asArray<unknown>(attachment.addedNames)
    for (const name of addedNames) {
      if (typeof name === 'string') servers.add(normalizeMcpServerName(name))
    }
  }

  return [...servers].sort()
}

// Extract PR links from pr-link entries
const extractPrLinks = (entries: ParsedRawEntry[]): SessionDigestPrLink[] => {
  const seen = new Set<string>()
  const links: SessionDigestPrLink[] = []

  for (const entry of entries) {
    if (getEntryType(entry) !== 'pr-link') continue

    const url = getString(entry.raw.prUrl)
    const number = typeof entry.raw.prNumber === 'number' ? entry.raw.prNumber : undefined
    const repository = getString(entry.raw.prRepository)

    if (!url || !number || !repository) continue
    // Deduplicate by URL (CC sometimes writes duplicate pr-link entries)
    if (seen.has(url)) continue
    seen.add(url)

    links.push({ url, number, repository })
  }

  return links
}

// Resolve repository from: pr-link entries > git remote (at sync time) > cwd path
const resolveRepository = async (
  entries: ParsedRawEntry[],
  prLinks: SessionDigestPrLink[],
  cwd?: string,
): Promise<SessionDigestRepository | undefined> => {
  // Priority 1: PR link repo (most reliable — comes from GitHub URL)
  if (prLinks.length > 0) {
    const repo = prLinks[0]!.repository
    const parts = repo.split('/')
    if (parts.length === 2) {
      return { owner: parts[0]!, name: parts[1]!, fullName: repo, source: 'pr_link' }
    }
  }

  // Priority 2: git remote from tool results (grep for github URLs in Bash outputs)
  for (const entry of entries) {
    if (getEntryType(entry) !== 'user') continue
    const content = entry.raw.message
    if (!isRecord(content)) continue
    const blocks = asArray<unknown>(content.content)
    for (const block of blocks) {
      if (!isRecord(block) || getString(block.type) !== 'tool_result') continue
      const text = extractToolResultText(block)
      if (!text) continue

      // Match git remote URLs: git@github.com:owner/repo.git or https://github.com/owner/repo
      // Be strict: owner/repo must be alphanumeric/dash/underscore only
      const match = text.match(/(?:github\.com[:/])([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\s|$|[)\]"'])/m)
      if (match?.[1] && match?.[2]) {
        return {
          owner: match[1],
          name: match[2],
          fullName: `${match[1]}/${match[2]}`,
          source: 'git_remote',
        }
      }
    }
  }

  // Priority 3: Derive from cwd path (least reliable but always available)
  if (cwd) {
    const repository = await resolveRepositoryFromCwd(cwd)
    if (repository) {
      return {
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        source: 'git_remote',
      }
    }

    return deriveRepoFromCwd(cwd)
  }

  return undefined
}

const extractToolResultText = (block: Record<string, unknown>): string | undefined => {
  const content = block.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b): b is Record<string, unknown> => isRecord(b) && getString(b.type) === 'text')
      .map(b => getString(b.text) ?? '')
      .join('\n')
  }
  return undefined
}

const deriveRepoFromCwd = (cwd: string): SessionDigestRepository | undefined => {
  // Strip home dir prefix and common path segments
  const cleaned = cwd
    .replace(/^\/Users\/[^/]+\//, '')
    .replace(/^\/home\/[^/]+\//, '')
    .replace(/^Developer\//, '')
    .replace(/^dev\//, '')

  const segments = cleaned.split('/').filter(s => s && s !== '.')
  if (segments.length < 1) return undefined

  // Use last 2 meaningful segments as owner/name
  if (segments.length >= 2) {
    const owner = segments[segments.length - 2]!
    const name = segments[segments.length - 1]!
    return { owner, name, fullName: `${owner}/${name}`, source: 'cwd_derived' }
  }

  return {
    owner: 'local',
    name: segments[0]!,
    fullName: `local/${segments[0]!}`,
    source: 'cwd_derived',
  }
}

// Cache hit rate: cache_read / (input + cache_write + cache_read)
const computeCacheHitRate = (metrics: {
  inputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}): number | undefined => {
  const total = metrics.inputTokens + metrics.cacheCreationInputTokens + metrics.cacheReadInputTokens
  if (total === 0) return undefined
  return metrics.cacheReadInputTokens / total
}

// Active duration: raw duration minus idle gaps (>5min between events)
const IDLE_THRESHOLD_MS = 5 * 60 * 1000

const computeActiveDuration = (
  entries: ParsedRawEntry[],
  rawDurationMs: number | undefined,
): number | undefined => {
  if (!rawDurationMs) return undefined

  const timestamps = entries
    .map(getEntryTimestamp)
    .filter((ts): ts is string => Boolean(ts))
    .map(ts => new Date(ts).getTime())
    .sort((a, b) => a - b)

  if (timestamps.length < 2) return rawDurationMs

  let idleMs = 0
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i]! - timestamps[i - 1]!
    if (gap > IDLE_THRESHOLD_MS) {
      idleMs += gap - IDLE_THRESHOLD_MS
    }
  }

  return Math.max(rawDurationMs - idleMs, 0)
}
