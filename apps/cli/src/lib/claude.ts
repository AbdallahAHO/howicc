import type { OpenRouterCatalog } from '@howicc/model-pricing'
import { fetchOpenRouterCatalog } from '@howicc/model-pricing'
import {
  createSourceRevisionHashFromFiles,
  type DiscoveredSession,
} from '@howicc/parser-core'
import { ClaudeCodeAdapter } from '@howicc/provider-claude-code'
import { buildRenderDocument } from '@howicc/render'

let cachedCatalog: OpenRouterCatalog | undefined

/**
 * Fetch pricing catalog once per CLI run. Cached in memory.
 * Returns undefined on failure — cost estimation is optional.
 */
export const getPricingCatalog = async (): Promise<OpenRouterCatalog | undefined> => {
  if (cachedCatalog) return cachedCatalog

  try {
    cachedCatalog = await fetchOpenRouterCatalog()
    return cachedCatalog
  } catch {
    return undefined
  }
}

export const discoverClaudeSessions = async () => ClaudeCodeAdapter.discoverSessions()

export const buildDiscoveredSessionKey = (
  session: Pick<DiscoveredSession, 'provider' | 'sessionId'>,
) => `${session.provider}:${session.sessionId}`

export const getSessionSourceRevisionHash = async (session: DiscoveredSession) => {
  const bundle = await ClaudeCodeAdapter.buildSourceBundle(session)
  return createSourceRevisionHashFromFiles(bundle.files)
}

export const buildSessionSourceRevisionHashIndex = async (
  sessions: DiscoveredSession[],
) => {
  const entries = await Promise.all(
    sessions.map(async session => {
      try {
        return [buildDiscoveredSessionKey(session), await getSessionSourceRevisionHash(session)] as const
      } catch {
        return [buildDiscoveredSessionKey(session), undefined] as const
      }
    }),
  )

  return new Map(entries)
}

export const getSessionById = async (sessionId: string) => {
  const sessions = await discoverClaudeSessions()
  return sessions.find(session => session.sessionId === sessionId)
}

export const buildCanonicalFromSession = async (
  session: DiscoveredSession,
  options?: { pricingCatalog?: OpenRouterCatalog },
) => {
  const bundle = await ClaudeCodeAdapter.buildSourceBundle(session)
  const canonical = await ClaudeCodeAdapter.parseCanonicalSession(bundle, options)
  const render = buildRenderDocument(canonical)
  return { session, bundle, canonical, render }
}

export const inspectClaudeSession = async (
  sessionId: string,
  options?: { pricingCatalog?: OpenRouterCatalog },
) => {
  const session = await getSessionById(sessionId)
  if (!session) return undefined
  return buildCanonicalFromSession(session, options)
}
