import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { EyeOff } from 'lucide-react'
import type { RepoHiddenConversation } from '@howicc/contracts'

type Props = {
  apiUrl: string
  owner: string
  name: string
  initialHidden: RepoHiddenConversation[]
}

const formatRelativeDate = (iso: string): string => {
  try {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return iso
    const diff = Date.now() - then
    const minutes = Math.round(diff / (1000 * 60))
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 14) return `${days}d ago`
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function RepoHiddenListIsland({
  apiUrl,
  owner,
  name,
  initialHidden,
}: Props) {
  const [items, setItems] = useState<RepoHiddenConversation[]>(initialHidden)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUnhide = async (conversationId: string) => {
    setWorkingId(conversationId)
    setError(null)
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/+$/, '')}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/hide/${encodeURIComponent(conversationId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      if (!response.ok) throw new Error(`Unhide failed with ${response.status}`)
      setItems((prev) => prev.filter((item) => item.conversationId !== conversationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unhide.')
    } finally {
      setWorkingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
        <EyeOff className="text-muted-foreground size-6" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">Nothing hidden</p>
        <p className="text-muted-foreground max-w-[42ch] text-xs text-pretty">
          As admins hide conversations from repo aggregation, they'll appear here.
          Owners can still share the same conversations via direct link.
        </p>
      </div>
    )
  }

  return (
    <ul role="list" className="flex flex-col divide-y divide-border/60">
      {items.map((item) => (
        <li
          key={item.conversationId}
          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:justify-between"
        >
          <div className="min-w-0">
            <a
              href={`/s/${item.slug}`}
              className="text-foreground hover:text-primary truncate text-sm font-medium"
            >
              {item.title}
            </a>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Hidden by <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.6875rem]">{item.hiddenBy}</code>
              <span className="mx-1">·</span>
              {formatRelativeDate(item.hiddenAt)}
              <span className="mx-1">·</span>
              <span>{item.visibility}</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUnhide(item.conversationId)}
            disabled={workingId === item.conversationId}
          >
            {workingId === item.conversationId ? 'Unhiding…' : 'Unhide'}
          </Button>
        </li>
      ))}
      {error ? (
        <li className="text-destructive py-2 text-sm">{error}</li>
      ) : null}
    </ul>
  )
}
