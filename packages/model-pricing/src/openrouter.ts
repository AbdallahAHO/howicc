import type { OpenRouterCatalog, OpenRouterCatalogModel } from './types'

export type OpenRouterApiResponse = {
  data?: Array<{
    id?: string
    canonical_slug?: string | null
    name?: string
    context_length?: number | null
    pricing?: {
      prompt?: string | number | null
      completion?: string | number | null
      input_cache_read?: string | number | null
      input_cache_write?: string | number | null
    } | null
  }>
}

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export const fetchOpenRouterCatalogPayload = async (input?: {
  fetch?: typeof fetch
  url?: string
}): Promise<{ payload: OpenRouterApiResponse; fetchedAt: string; rawJson: string; sourceUrl: string }> => {
  const fetchFn = input?.fetch ?? fetch
  const sourceUrl = input?.url ?? OPENROUTER_MODELS_URL
  const fetchedAt = new Date().toISOString()
  const response = await fetchFn(sourceUrl)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenRouter model catalog: ${response.status} ${response.statusText}`,
    )
  }

  const rawJson = await response.text()
  const payload = JSON.parse(rawJson) as OpenRouterApiResponse

  return {
    payload,
    fetchedAt,
    rawJson,
    sourceUrl,
  }
}

export const fetchOpenRouterCatalog = async (
  input?: {
    fetch?: typeof fetch
    url?: string
  },
): Promise<OpenRouterCatalog> => {
  const { payload, fetchedAt } = await fetchOpenRouterCatalogPayload(input)

  return normalizeOpenRouterCatalog(payload, { fetchedAt })
}

export const normalizeOpenRouterCatalog = (
  payload: OpenRouterApiResponse,
  options?: { fetchedAt?: string },
): OpenRouterCatalog => ({
  source: 'openrouter_public_catalog',
  fetchedAt: options?.fetchedAt ?? new Date().toISOString(),
  models: (payload.data ?? [])
    .map(normalizeOpenRouterModel)
    .filter((model): model is OpenRouterCatalogModel => Boolean(model)),
})

const normalizeOpenRouterModel = (
  model: NonNullable<OpenRouterApiResponse['data']>[number],
): OpenRouterCatalogModel | undefined => {
  if (!model.id || !model.name || !model.pricing?.prompt || !model.pricing?.completion) {
    return undefined
  }

  return {
    source: 'openrouter_public_catalog',
    id: model.id,
    canonicalSlug: model.canonical_slug ?? undefined,
    displayName: model.name,
    contextLength: model.context_length ?? undefined,
    promptUsdPerToken: parsePrice(model.pricing.prompt),
    completionUsdPerToken: parsePrice(model.pricing.completion),
    inputCacheReadUsdPerToken: parseOptionalPrice(model.pricing.input_cache_read),
    inputCacheWriteUsdPerToken: parseOptionalPrice(model.pricing.input_cache_write),
  }
}

const parsePrice = (value: string | number): number =>
  typeof value === 'number' ? value : Number.parseFloat(value)

const parseOptionalPrice = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined
  return parsePrice(value)
}
