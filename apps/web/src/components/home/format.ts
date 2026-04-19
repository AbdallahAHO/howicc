/**
 * Small, pure formatters for dashboard values.
 *
 * Shared between `home.astro` (Stats cards, CLI copy hints) and the
 * `ActivityFeedIsland` so SSR and client rendering stay byte-identical.
 */

export const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs < 1000) return '—'
  const totalSeconds = Math.round(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

export const formatCost = (cost?: number): string => {
  if (cost === undefined || cost === null) return '—'
  if (cost === 0) return '$0'
  if (cost < 0.01) return '<$0.01'
  return `$${cost.toFixed(2)}`
}

export const formatRelative = (iso: string): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.valueOf())) return iso
  const diffMs = Date.now() - then.valueOf()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
