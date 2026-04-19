import { useEffect, useRef, useState } from 'react'
import type {
  ConversationVisibility,
  ProfileActivityResponse,
} from '@howicc/contracts'
import { Badge } from '@howicc/ui-web/badge'
import { Button } from '@howicc/ui-web/button'
import { AlertTriangle, Loader2, Search, X } from 'lucide-react'
import { createBrowserApiClient } from '../../lib/api/client'
import { unwrapSuccess } from '../../lib/api/unwrap'
import type { ActivityItem, ActivitySessionType, ActivityVisibility } from './activity-types'
import { formatCost, formatDuration, formatRelative } from './format'

type VisibilityFilter = ConversationVisibility | 'all'

type Props = {
  apiUrl: string
  initialItems: ActivityItem[]
  initialCursor?: string
  total: number
  pageSize?: number
  showFilters?: boolean
}

const visibilityOptions: Array<{ value: VisibilityFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'private', label: 'Private' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'public', label: 'Public' },
]

const sessionTypeLabel: Record<ActivitySessionType, string> = {
  building: 'Building',
  debugging: 'Debugging',
  exploring: 'Exploring',
  investigating: 'Investigating',
  mixed: 'Mixed',
}

const sessionTypeTone: Record<ActivitySessionType, 'default' | 'secondary' | 'outline'> = {
  building: 'default',
  debugging: 'secondary',
  exploring: 'secondary',
  investigating: 'secondary',
  mixed: 'outline',
}

const visibilityLabel: Record<ActivityVisibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
}

export const ActivityFeedIsland = ({
  apiUrl,
  initialItems,
  initialCursor,
  total: initialTotal,
  pageSize = 10,
  showFilters = false,
}: Props) => {
  const [items, setItems] = useState<ActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [total, setTotal] = useState<number>(initialTotal)
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [visibility, setVisibility] = useState<VisibilityFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const canLoadMore = items.length < total && cursor !== undefined

  // Skip the filter-refetch effect on the very first render: SSR already
  // delivered the unfiltered first page.
  const initialRenderRef = useRef(true)

  useEffect(() => {
    if (!showFilters) return
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(handle)
  }, [search, showFilters])

  useEffect(() => {
    if (!showFilters) return
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      return
    }

    let cancelled = false
    setRefreshing(true)
    setError(null)

    const fetchFiltered = async () => {
      try {
        const api = createBrowserApiClient(apiUrl)
        const response = await api.profile.activity({
          limit: pageSize,
          visibility: visibility === 'all' ? undefined : visibility,
          q: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        })
        const envelope = unwrapSuccess<ProfileActivityResponse>(response)
        if (cancelled) return
        if (!envelope) {
          setError('Could not apply the filters. Try again.')
          return
        }
        setItems(envelope.items)
        setCursor(envelope.nextCursor)
        setTotal(envelope.total)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(err instanceof Error ? err.message : 'Could not apply the filters.')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }

    void fetchFiltered()
    return () => {
      cancelled = true
    }
  }, [apiUrl, debouncedSearch, pageSize, showFilters, visibility])

  const loadMore = async () => {
    if (!canLoadMore || pending) return
    setPending(true)
    setError(null)
    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.profile.activity({
        cursor,
        limit: pageSize,
        visibility: showFilters && visibility !== 'all' ? visibility : undefined,
        q: showFilters && debouncedSearch.length > 0 ? debouncedSearch : undefined,
      })
      const envelope = unwrapSuccess<ProfileActivityResponse>(response)

      if (!envelope) {
        setError('Could not load more sessions. Try again.')
        return
      }

      setItems((current) => [...current, ...envelope.items])
      setCursor(envelope.nextCursor)
      setTotal(envelope.total)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load more sessions.')
    } finally {
      setPending(false)
    }
  }

  const filtersActive =
    showFilters && (visibility !== 'all' || debouncedSearch.length > 0)

  const clearFilters = () => {
    setVisibility('all')
    setSearch('')
  }

  return (
    <>
      {showFilters ? (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="border-border/60 bg-background focus-within:border-border focus-within:ring-ring/40 flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 transition-colors focus-within:ring-3">
              <Search aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles and projects"
                aria-label="Search sessions"
                className="text-foreground placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {search.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="touch-target"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <div
              role="radiogroup"
              aria-label="Visibility"
              className="border-border/60 bg-muted/20 flex shrink-0 items-center rounded-md border p-0.5"
            >
              {visibilityOptions.map((option) => {
                const active = visibility === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(option.value)}
                    className={[
                      'text-muted-foreground hover:text-foreground touch-target inline-flex h-8 items-center rounded px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      active ? 'bg-background text-foreground shadow-xs' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          {filtersActive ? (
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs">
                Filtered · <span className="tabular-nums">{items.length}</span> of
                <span className="tabular-nums"> {total}</span>.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
              {refreshing ? (
                <Loader2
                  aria-hidden="true"
                  className="text-muted-foreground size-3.5 animate-spin"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {filtersActive && items.length === 0 && !refreshing ? (
        <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-xl border border-dashed p-5 text-sm">
          <p className="text-foreground font-medium">No sessions match these filters.</p>
          <p className="text-muted-foreground text-pretty">
            Try a broader search or clear the filters.
          </p>
        </div>
      ) : null}

      <ol role="list" className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={item.conversationId}
            className={[
              'flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
              index > 0 ? 'border-border/60 border-t' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={sessionTypeTone[item.sessionType]}>
                  {sessionTypeLabel[item.sessionType]}
                </Badge>
                <a
                  href={`/s/${item.slug}`}
                  className="text-foreground hover:text-primary min-w-0 truncate text-sm font-medium transition-colors"
                >
                  {item.title}
                </a>
                {item.hasPlan ? (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Plan
                  </Badge>
                ) : null}
                {item.visibility !== 'private' ? (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    {visibilityLabel[item.visibility]}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {item.repository ? (
                  <>
                    <span className="font-mono">{item.repository.fullName}</span>
                    <span aria-hidden="true">·</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono max-w-[24ch] truncate">{item.projectKey}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {item.models.length > 0 ? (
                  <>
                    <span className="font-mono">{item.models[0]}</span>
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <span className="tabular-nums">{item.toolRunCount} tool runs</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{item.turnCount} turns</span>
              </p>
            </div>
            <dl className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-xs sm:flex-col sm:items-end sm:gap-y-1 sm:text-right">
              <div className="flex items-baseline gap-1.5 sm:justify-end">
                <dt className="text-muted-foreground sr-only">Duration</dt>
                <dd className="text-foreground tabular-nums font-medium">
                  {formatDuration(item.durationMs)}
                </dd>
                <span className="text-muted-foreground" aria-hidden="true">
                  ·
                </span>
                <dt className="text-muted-foreground sr-only">Cost</dt>
                <dd className="text-muted-foreground tabular-nums">
                  {formatCost(item.estimatedCostUsd)}
                </dd>
              </div>
              <div className="text-muted-foreground text-xs">
                <dt className="sr-only">Synced</dt>
                <dd>
                  Synced <time dateTime={item.syncedAt}>{formatRelative(item.syncedAt)}</time>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <footer className="mt-4 flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <p>
            Showing <span className="tabular-nums">{items.length}</span> of{' '}
            <span className="tabular-nums">{total}</span>.
          </p>
          {canLoadMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={pending}
              data-icon={pending ? 'inline-start' : undefined}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? 'Loading more…' : 'Show more'}
            </Button>
          ) : items.length > 0 && items.length === total ? (
            <p className="text-muted-foreground">Caught up.</p>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive inline-flex items-center gap-1.5 text-xs">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            {error}
          </p>
        ) : null}
      </footer>
    </>
  )
}

export default ActivityFeedIsland
