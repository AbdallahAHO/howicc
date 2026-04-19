import type { ParsedRawEntry } from '../jsonl'
import {
  getEntryParentUuid,
  getEntryTimestamp,
  getEntryType,
  getEntryUuid,
  isSidechainEntry,
} from './raw'

type ThreadSelection = {
  selectedEntries: ParsedRawEntry[]
  selectedLeafUuid?: string
  branchCount: number
}

const isConversationEntry = (entry: ParsedRawEntry): boolean => {
  const type = getEntryType(entry)
  return type === 'user' || type === 'assistant' || type === 'system'
}

export const selectActiveThread = (
  entries: ParsedRawEntry[],
  options?: { includeSidechain?: boolean },
): ThreadSelection => {
  const includeSidechain = options?.includeSidechain ?? false

  const chainEntries = entries.filter(entry => {
    const type = getEntryType(entry)
    const uuid = getEntryUuid(entry)

    return (
      Boolean(uuid) &&
      isConversationEntry(entry) &&
      (includeSidechain || !isSidechainEntry(entry))
    )
  })
  const traversableEntriesByUuid = new Map(
    entries
      .filter(entry => {
        const uuid = getEntryUuid(entry)
        return Boolean(uuid) && (includeSidechain || !isSidechainEntry(entry))
      })
      .map(entry => [getEntryUuid(entry)!, entry] as const),
  )

  if (chainEntries.length === 0) {
    return { selectedEntries: [], branchCount: 0 }
  }

  const referencedParents = new Set(
    chainEntries
      .map(getEntryParentUuid)
      .filter((parentUuid): parentUuid is string => Boolean(parentUuid)),
  )

  const leaves = chainEntries.filter(entry => {
    const uuid = getEntryUuid(entry)
    return uuid ? !referencedParents.has(uuid) : false
  })

  const selectedLeaf = [...leaves].sort((left, right) => {
    const leftTimestamp = getEntryTimestamp(left) ?? ''
    const rightTimestamp = getEntryTimestamp(right) ?? ''

    return leftTimestamp.localeCompare(rightTimestamp)
  })[leaves.length - 1]

  const chainUuids = new Set<string>()
  const selectedPathUuids = new Set<string>()
  let currentEntry = selectedLeaf

  while (currentEntry) {
    const currentUuid = getEntryUuid(currentEntry)
    if (!currentUuid || chainUuids.has(currentUuid)) break

    chainUuids.add(currentUuid)
    selectedPathUuids.add(currentUuid)
    currentEntry = resolveParentConversationEntry(
      currentEntry,
      traversableEntriesByUuid,
      selectedPathUuids,
      chainUuids,
    )
  }

  const selectedEntries = entries.filter(entry => {
    if (!includeSidechain && isSidechainEntry(entry)) return false

    const uuid = getEntryUuid(entry)
    if (uuid && selectedPathUuids.has(uuid)) return true

    const sourceToolAssistantUUID =
      typeof entry.raw.sourceToolAssistantUUID === 'string'
        ? entry.raw.sourceToolAssistantUUID
        : undefined

    if (sourceToolAssistantUUID && chainUuids.has(sourceToolAssistantUUID)) {
      return true
    }

    const parentUuid = getEntryParentUuid(entry)
    if (
      parentUuid &&
      selectedPathUuids.has(parentUuid) &&
      (getEntryType(entry) === 'assistant' || getEntryType(entry) === 'system')
    ) {
      return true
    }

    return false
  })

  return {
    selectedEntries,
    selectedLeafUuid: selectedLeaf ? getEntryUuid(selectedLeaf) : undefined,
    branchCount: leaves.length,
  }
}

const resolveParentConversationEntry = (
  entry: ParsedRawEntry,
  traversableEntriesByUuid: Map<string, ParsedRawEntry>,
  selectedPathUuids: Set<string>,
  chainUuids: Set<string>,
): ParsedRawEntry | undefined => {
  let parentUuid = getEntryParentUuid(entry)

  while (parentUuid) {
    if (selectedPathUuids.has(parentUuid) || chainUuids.has(parentUuid)) {
      return undefined
    }

    const parentEntry = traversableEntriesByUuid.get(parentUuid)
    if (!parentEntry) {
      return undefined
    }

    if (getEntryType(parentEntry) === 'attachment') {
      selectedPathUuids.add(parentUuid)
      parentUuid = getEntryParentUuid(parentEntry)
      continue
    }

    return parentEntry
  }

  return undefined
}
