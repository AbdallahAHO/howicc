import { useState } from 'react'
import { Badge } from '@howicc/ui-web/badge'
import { Button } from '@howicc/ui-web/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { createBrowserApiClient } from '../../lib/api/client'
import type { ActivityItem, ActivitySessionType, ActivityVisibility } from './activity-types'
import { formatCost, formatDuration, formatRelative } from './format'

type Props = {
  apiUrl: string
  initialItems: ActivityItem[]
  initialCursor?: string
  total: number
  pageSize?: number
}

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

type ActivityPageResponse = {
  success: true
  items: ActivityItem[]
  nextCursor?: string
  total: number
}

const isSuccessPage = (value: unknown): value is ActivityPageResponse =>
  Boolean(value) &&
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  (value as { success?: unknown }).success === true &&
  Array.isArray((value as { items?: unknown }).items)

export const ActivityFeedIsland = ({
  apiUrl,
  initialItems,
  initialCursor,
  total,
  pageSize = 10,
}: Props) => {
  const [items, setItems] = useState<ActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLoadMore = items.length < total && cursor !== undefined

  const loadMore = async () => {
    if (!canLoadMore || pending) return
    setPending(true)
    setError(null)
    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.profile.activity({ cursor, limit: pageSize })

      if (!isSuccessPage(response)) {
        setError('Could not load more sessions. Try again.')
        return
      }

      setItems((current) => [...current, ...response.items])
      setCursor(response.nextCursor)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load more sessions.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
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
