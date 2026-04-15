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
      (type === 'user' || type === 'assistant' || type === 'system') &&
      (includeSidechain || !isSidechainEntry(entry))
    )
  })

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
  let currentEntry = selectedLeaf

  while (currentEntry) {
    const currentUuid = getEntryUuid(currentEntry)
    if (!currentUuid || chainUuids.has(currentUuid)) break

    chainUuids.add(currentUuid)
    const parentUuid = getEntryParentUuid(currentEntry)
    currentEntry = parentUuid
      ? chainEntries.find(entry => getEntryUuid(entry) === parentUuid)
      : undefined
  }

  const selectedEntries = entries.filter(entry => {
    if (!includeSidechain && isSidechainEntry(entry)) return false

    const uuid = getEntryUuid(entry)
    if (uuid && chainUuids.has(uuid)) return true

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
      chainUuids.has(parentUuid) &&
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
