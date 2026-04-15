export type ModelUsageEntry = {
  eventId: string
  timestamp?: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
}

export type OpenRouterCatalogModel = {
  source: 'openrouter_public_catalog'
  id: string
  canonicalSlug?: string
  displayName: string
  contextLength?: number
  promptUsdPerToken: number
  completionUsdPerToken: number
  inputCacheReadUsdPerToken?: number
  inputCacheWriteUsdPerToken?: number
}

export type OpenRouterCatalog = {
  source: 'openrouter_public_catalog'
  fetchedAt: string
  models: OpenRouterCatalogModel[]
}

export type ModelMatchType =
  | 'exact_id'
  | 'exact_canonical_slug'
  | 'generated_id_alias'
  | 'generated_slug_alias'
  | 'contextual_family_alias'
  | 'unmatched'

export type ModelMatch = {
  localModelId: string
  normalizedLocalModelId: string
  matchType: ModelMatchType
  candidateIds: string[]
  catalogModel?: OpenRouterCatalogModel
}

export type CostReliability =
  | 'exact_catalog_match'
  | 'alias_match'
  | 'partial'
  | 'not_available'

export type ModelCostBreakdown = {
  localModelId: string
  matchedCatalogId?: string
  matchedCanonicalSlug?: string
  matchType: ModelMatchType
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheWriteInputTokens: number
  }
  estimatedCostUsd?: number
  pricingComplete: boolean
}

export type SessionCostEstimate = {
  source: 'openrouter_public_catalog'
  catalogFetchedAt?: string
  estimatedCostUsd?: number
  reliability: CostReliability
  matchedModels: string[]
  unmatchedModels: string[]
  breakdown: ModelCostBreakdown[]
}
