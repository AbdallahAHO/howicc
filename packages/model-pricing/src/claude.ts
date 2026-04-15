import type { ModelMatch, OpenRouterCatalog, OpenRouterCatalogModel } from './types'

export const sanitizeClaudeModelId = (value: string): string =>
  value
    .replace(/\x1B\[[0-9;]*m/g, '')
    .replace(/\[[^\]]+\]$/g, '')
    .trim()
    .toLowerCase()

export const getClaudeModelFamily = (
  localModelId: string,
): 'haiku' | 'sonnet' | 'opus' | undefined => {
  const normalized = sanitizeClaudeModelId(localModelId)

  if (normalized === 'haiku' || normalized === 'sonnet' || normalized === 'opus') {
    return normalized
  }

  const parsed = parseClaudeModelId(normalized)
  return parsed?.family
}

export const generateClaudeOpenRouterCandidates = (localModelId: string): string[] => {
  const normalized = sanitizeClaudeModelId(localModelId)

  const candidates = new Set<string>([normalized, `anthropic/${normalized}`])

  const parsed = parseClaudeModelId(normalized)

  if (!parsed) {
    return [...candidates]
  }

  const version = parsed.minor ? `${parsed.major}.${parsed.minor}` : parsed.major
  const versionPrefix = `anthropic/claude-${version}-${parsed.family}`
  const versionSuffix = `anthropic/claude-${parsed.family}-${version}`

  candidates.add(versionSuffix)
  candidates.add(parsed.date ? `${versionPrefix}-${parsed.date}` : versionPrefix)

  return [...candidates]
}

export const matchClaudeModel = (
  localModelId: string,
  catalog: OpenRouterCatalog,
): ModelMatch => {
  const normalizedLocalModelId = sanitizeClaudeModelId(localModelId)

  const exactId = catalog.models.find(
    model => sanitizeClaudeModelId(model.id) === normalizedLocalModelId,
  )
  if (exactId) {
    return {
      localModelId,
      normalizedLocalModelId,
      matchType: 'exact_id',
      candidateIds: [normalizedLocalModelId],
      catalogModel: exactId,
    }
  }

  const exactSlug = catalog.models.find(
    model =>
      model.canonicalSlug &&
      sanitizeClaudeModelId(model.canonicalSlug) === normalizedLocalModelId,
  )
  if (exactSlug) {
    return {
      localModelId,
      normalizedLocalModelId,
      matchType: 'exact_canonical_slug',
      candidateIds: [normalizedLocalModelId],
      catalogModel: exactSlug,
    }
  }

  const candidates = generateClaudeOpenRouterCandidates(localModelId)

  const aliasId = findAliasModel(catalog.models, candidates, 'id')
  if (aliasId) {
    return {
      localModelId,
      normalizedLocalModelId,
      matchType: 'generated_id_alias',
      candidateIds: candidates,
      catalogModel: aliasId,
    }
  }

  const aliasSlug = findAliasModel(catalog.models, candidates, 'canonicalSlug')
  if (aliasSlug) {
    return {
      localModelId,
      normalizedLocalModelId,
      matchType: 'generated_slug_alias',
      candidateIds: candidates,
      catalogModel: aliasSlug,
    }
  }

  return {
    localModelId,
    normalizedLocalModelId,
    matchType: 'unmatched',
    candidateIds: candidates,
  }
}

const findAliasModel = (
  models: OpenRouterCatalogModel[],
  candidates: string[],
  field: 'id' | 'canonicalSlug',
): OpenRouterCatalogModel | undefined =>
  models.find(model => {
    const value = field === 'id' ? model.id : model.canonicalSlug
    if (!value) return false
    const normalizedValue = sanitizeClaudeModelId(value)
    return candidates.includes(normalizedValue)
  })

const parseClaudeModelId = (
  normalizedModelId: string,
): {
  family: 'haiku' | 'sonnet' | 'opus'
  major: string
  minor?: string
  date?: string
} | null => {
  const match = normalizedModelId.match(
    /^claude-(haiku|sonnet|opus)-(\d+)(?:-(\d+))?(?:-(\d{8}))?$/,
  )

  if (!match) return null

  return {
    family: match[1] as 'haiku' | 'sonnet' | 'opus',
    major: match[2]!,
    minor: match[3] ?? undefined,
    date: match[4] ?? undefined,
  }
}
