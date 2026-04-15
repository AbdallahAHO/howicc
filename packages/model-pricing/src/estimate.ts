import { getClaudeModelFamily, matchClaudeModel } from './claude'
import type {
  CostReliability,
  ModelCostBreakdown,
  ModelUsageEntry,
  OpenRouterCatalog,
  SessionCostEstimate,
} from './types'

export const estimateClaudeConversationCost = (input: {
  usageEntries: ModelUsageEntry[]
  catalog: OpenRouterCatalog
}): SessionCostEstimate => {
  if (input.usageEntries.length === 0) {
    return {
      source: 'openrouter_public_catalog',
      catalogFetchedAt: input.catalog.fetchedAt,
      reliability: 'not_available',
      matchedModels: [],
      unmatchedModels: [],
      breakdown: [],
    }
  }

  const usageByModel = new Map<string, ModelUsageEntry>()

  for (const usageEntry of input.usageEntries) {
    const existing = usageByModel.get(usageEntry.model)

    if (!existing) {
      usageByModel.set(usageEntry.model, { ...usageEntry })
      continue
    }

    existing.inputTokens += usageEntry.inputTokens
    existing.outputTokens += usageEntry.outputTokens
    existing.cacheReadInputTokens += usageEntry.cacheReadInputTokens
    existing.cacheWriteInputTokens += usageEntry.cacheWriteInputTokens
  }

  const breakdown = [...usageByModel.values()].map<ModelCostBreakdown>(usage => {
    const match = matchClaudeModel(usage.model, input.catalog)

    if (!match.catalogModel) {
      return {
        localModelId: usage.model,
        matchType: match.matchType,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadInputTokens: usage.cacheReadInputTokens,
          cacheWriteInputTokens: usage.cacheWriteInputTokens,
        },
        pricingComplete: false,
      }
    }

    const promptCost = usage.inputTokens * match.catalogModel.promptUsdPerToken
    const completionCost =
      usage.outputTokens * match.catalogModel.completionUsdPerToken
    const cacheReadCost =
      usage.cacheReadInputTokens *
      (match.catalogModel.inputCacheReadUsdPerToken ?? 0)
    const cacheWriteCost =
      usage.cacheWriteInputTokens *
      (match.catalogModel.inputCacheWriteUsdPerToken ?? 0)

    const pricingComplete =
      usage.cacheReadInputTokens === 0 ||
      typeof match.catalogModel.inputCacheReadUsdPerToken === 'number'
        ? usage.cacheWriteInputTokens === 0 ||
          typeof match.catalogModel.inputCacheWriteUsdPerToken === 'number'
        : false

    return {
      localModelId: usage.model,
      matchedCatalogId: match.catalogModel.id,
      matchedCanonicalSlug: match.catalogModel.canonicalSlug,
      matchType: match.matchType,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheWriteInputTokens: usage.cacheWriteInputTokens,
      },
      estimatedCostUsd: promptCost + completionCost + cacheReadCost + cacheWriteCost,
      pricingComplete,
    }
  })

  const familyMatchedCatalog = new Map<
    'haiku' | 'sonnet' | 'opus',
    Set<NonNullable<ModelCostBreakdown['matchedCatalogId']>>
  >()

  for (const entry of breakdown) {
    if (!entry.matchedCatalogId) continue

    const family = getClaudeModelFamily(entry.localModelId)
    if (!family) continue

    const existing = familyMatchedCatalog.get(family) ?? new Set<string>()
    existing.add(entry.matchedCatalogId)
    familyMatchedCatalog.set(family, existing)
  }

  const enrichedBreakdown = breakdown.map(entry => {
    if (entry.matchedCatalogId) return entry

    const family = getClaudeModelFamily(entry.localModelId)
    if (!family) return entry

    const candidates = familyMatchedCatalog.get(family)
    if (!candidates || candidates.size !== 1) return entry

    const matchedCatalogId = [...candidates][0]
    const catalogModel = input.catalog.models.find(model => model.id === matchedCatalogId)
    if (!catalogModel) return entry

    const promptCost = entry.usage.inputTokens * catalogModel.promptUsdPerToken
    const completionCost =
      entry.usage.outputTokens * catalogModel.completionUsdPerToken
    const cacheReadCost =
      entry.usage.cacheReadInputTokens *
      (catalogModel.inputCacheReadUsdPerToken ?? 0)
    const cacheWriteCost =
      entry.usage.cacheWriteInputTokens *
      (catalogModel.inputCacheWriteUsdPerToken ?? 0)

    const pricingComplete =
      entry.usage.cacheReadInputTokens === 0 ||
      typeof catalogModel.inputCacheReadUsdPerToken === 'number'
        ? entry.usage.cacheWriteInputTokens === 0 ||
          typeof catalogModel.inputCacheWriteUsdPerToken === 'number'
        : false

    return {
      ...entry,
      matchedCatalogId: catalogModel.id,
      matchedCanonicalSlug: catalogModel.canonicalSlug,
      matchType: 'contextual_family_alias' as const,
      estimatedCostUsd: promptCost + completionCost + cacheReadCost + cacheWriteCost,
      pricingComplete,
    }
  })

  const matchedModels = enrichedBreakdown
    .filter(entry => Boolean(entry.matchedCatalogId))
    .map(entry => entry.localModelId)
  const unmatchedModels = enrichedBreakdown
    .filter(entry => !entry.matchedCatalogId)
    .map(entry => entry.localModelId)

  const totalCost = enrichedBreakdown
    .map(entry => entry.estimatedCostUsd ?? 0)
    .reduce((sum, value) => sum + value, 0)

  return {
    source: 'openrouter_public_catalog',
    catalogFetchedAt: input.catalog.fetchedAt,
    estimatedCostUsd: matchedModels.length > 0 ? totalCost : undefined,
    reliability: deriveReliability(enrichedBreakdown),
    matchedModels,
    unmatchedModels,
    breakdown: enrichedBreakdown,
  }
}

const deriveReliability = (
  breakdown: ModelCostBreakdown[],
): CostReliability => {
  if (breakdown.length === 0) return 'not_available'
  if (breakdown.every(entry => !entry.matchedCatalogId)) return 'not_available'
  if (
    breakdown.some(entry => !entry.matchedCatalogId || !entry.pricingComplete)
  ) {
    return 'partial'
  }
  if (
    breakdown.some(
      entry =>
        entry.matchType === 'generated_id_alias' ||
        entry.matchType === 'generated_slug_alias',
    )
  ) {
    return 'alias_match'
  }

  return 'exact_catalog_match'
}
