import { describe, expect, it } from 'vitest'
import {
  estimateClaudeConversationCost,
  generateClaudeOpenRouterCandidates,
  matchClaudeModel,
  normalizeOpenRouterCatalog,
  sanitizeClaudeModelId,
} from '..'

const catalog = normalizeOpenRouterCatalog(
  {
    data: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        canonical_slug: 'anthropic/claude-4.6-sonnet-20260217',
        name: 'Anthropic: Claude Sonnet 4.6',
        context_length: 1000000,
        pricing: {
          prompt: '0.000003',
          completion: '0.000015',
          input_cache_read: '0.0000003',
          input_cache_write: '0.00000375',
        },
      },
      {
        id: 'anthropic/claude-haiku-4.5',
        canonical_slug: 'anthropic/claude-4.5-haiku-20251001',
        name: 'Anthropic: Claude Haiku 4.5',
        context_length: 200000,
        pricing: {
          prompt: '0.0000008',
          completion: '0.000004',
          input_cache_read: '0.00000008',
          input_cache_write: '0.000001',
        },
      },
      {
        id: 'anthropic/claude-opus-4.5',
        canonical_slug: 'anthropic/claude-4.5-opus-20251124',
        name: 'Anthropic: Claude Opus 4.5',
        context_length: 200000,
        pricing: {
          prompt: '0.000015',
          completion: '0.000075',
          input_cache_read: '0.0000015',
          input_cache_write: '0.00001875',
        },
      },
    ],
  },
  { fetchedAt: '2026-04-09T00:00:00.000Z' },
)

describe('Claude model matching', () => {
  it('sanitizes local Claude model ids before matching', () => {
    expect(sanitizeClaudeModelId('claude-sonnet-4-6[1m]')).toBe('claude-sonnet-4-6')
  })

  it('generates strong Anthropic/OpenRouter candidates for Claude ids', () => {
    expect(generateClaudeOpenRouterCandidates('claude-sonnet-4-5-20250929')).toEqual(
      expect.arrayContaining([
        'claude-sonnet-4-5-20250929',
        'anthropic/claude-sonnet-4.5',
        'anthropic/claude-4.5-sonnet-20250929',
      ]),
    )
  })

  it('matches real local Claude ids to OpenRouter catalog entries', () => {
    expect(matchClaudeModel('claude-sonnet-4-6', catalog)).toMatchObject({
      matchType: 'generated_id_alias',
      catalogModel: { id: 'anthropic/claude-sonnet-4.6' },
    })

    expect(matchClaudeModel('claude-haiku-4-5-20251001', catalog)).toMatchObject({
      matchType: 'generated_id_alias',
      catalogModel: { canonicalSlug: 'anthropic/claude-4.5-haiku-20251001' },
    })

    expect(matchClaudeModel('claude-sonnet-4-6[1m]', catalog)).toMatchObject({
      matchType: 'generated_id_alias',
      catalogModel: { id: 'anthropic/claude-sonnet-4.6' },
    })
  })

  it('keeps ambiguous shorthand model names unmatched', () => {
    expect(matchClaudeModel('sonnet', catalog).matchType).toBe('unmatched')
  })
})

describe('Claude conversation cost estimation', () => {
  it('estimates cost from usage entries when models match the catalog', () => {
    const estimate = estimateClaudeConversationCost({
      catalog,
      usageEntries: [
        {
          eventId: 'a1',
          model: 'claude-sonnet-4-6',
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadInputTokens: 200,
          cacheWriteInputTokens: 0,
        },
        {
          eventId: 'a2',
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 500,
          outputTokens: 250,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 100,
        },
      ],
    })

    expect(estimate.reliability).toBe('alias_match')
    expect(estimate.matchedModels).toEqual(
      expect.arrayContaining([
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
      ]),
    )
    expect(estimate.unmatchedModels).toEqual([])
    expect(estimate.estimatedCostUsd).toBeCloseTo(0.01206, 8)
  })

  it('returns partial reliability when some models cannot be matched', () => {
    const estimate = estimateClaudeConversationCost({
      catalog,
      usageEntries: [
        {
          eventId: 'a1',
          model: 'claude-sonnet-4-6',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
        {
          eventId: 'a2',
          model: 'mystery-model',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
      ],
    })

    expect(estimate.reliability).toBe('partial')
    expect(estimate.unmatchedModels).toEqual(['mystery-model'])
  })

  it('can resolve shorthand family names contextually when the session already used one clear model in that family', () => {
    const estimate = estimateClaudeConversationCost({
      catalog,
      usageEntries: [
        {
          eventId: 'a1',
          model: 'claude-sonnet-4-6',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
        {
          eventId: 'a2',
          model: 'sonnet',
          inputTokens: 200,
          outputTokens: 75,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
      ],
    })

    expect(estimate.unmatchedModels).toEqual([])
    expect(estimate.breakdown.find(item => item.localModelId === 'sonnet')).toMatchObject({
      matchType: 'contextual_family_alias',
      matchedCatalogId: 'anthropic/claude-sonnet-4.6',
    })
  })
})
