import { useState } from 'react'
import { Badge } from '@howicc/ui-web/badge'
import { Button } from '@howicc/ui-web/button'
import { Checkbox } from '@howicc/ui-web/checkbox'
import { Separator } from '@howicc/ui-web/separator'
import { Globe, Lock, Users } from 'lucide-react'
import type {
  RepoVisibility,
  RepoVisibilityPreviewItem,
  RepoVisibilityPreviewResponse,
} from '@howicc/contracts'

type Props = {
  apiUrl: string
  owner: string
  name: string
  initialVisibility: RepoVisibility
}

type Option = {
  value: RepoVisibility
  label: string
  description: string
  Icon: typeof Globe
}

const OPTIONS: Option[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can see aggregate stats for this repo.',
    Icon: Globe,
  },
  {
    value: 'members',
    label: 'Members',
    description: 'Only GitHub collaborators with ≥ read access can view aggregate stats.',
    Icon: Users,
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Hide aggregate stats from everyone. Owner-shared links keep working.',
    Icon: Lock,
  },
]

const unwrapSuccess = <T extends { success: true }>(value: unknown): T | null => {
  if (value && typeof value === 'object' && 'success' in value && (value as { success?: unknown }).success === true) {
    return value as T
  }
  return null
}

export default function RepoVisibilityIsland({
  apiUrl,
  owner,
  name,
  initialVisibility,
}: Props) {
  const [current, setCurrent] = useState<RepoVisibility>(initialVisibility)
  const [pending, setPending] = useState<RepoVisibility | null>(null)
  const [preview, setPreview] = useState<RepoVisibilityPreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const resetPreview = () => {
    setPending(null)
    setPreview(null)
    setConfirmed(false)
    setError(null)
  }

  const handleSelect = async (value: RepoVisibility) => {
    if (submitting) return
    if (value === current) {
      resetPreview()
      return
    }
    setError(null)
    setSuccess(null)
    setPending(value)
    setConfirmed(false)
    setPreview(null)
    setPreviewLoading(true)
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/+$/, '')}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/preview?target=${value}`,
        { credentials: 'include' },
      )
      const body = (await response.json()) as unknown
      const envelope = unwrapSuccess<RepoVisibilityPreviewResponse>(body)
      if (!envelope) {
        throw new Error(`Preview failed with ${response.status}`)
      }
      setPreview(envelope)
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : 'Could not load preview.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleApply = async () => {
    if (!pending || !preview) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/+$/, '')}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/visibility`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visibility: pending,
            previewToken: preview.previewToken,
          }),
        },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(body?.error ?? `Update failed with ${response.status}`)
      }
      setCurrent(pending)
      setSuccess(`Visibility updated to ${pending}.`)
      resetPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update visibility.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3" disabled={submitting}>
        <legend className="sr-only">Repo visibility</legend>
        {OPTIONS.map((option) => {
          const active = (pending ?? current) === option.value
          const isCurrent = current === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => handleSelect(option.value)}
              className={`group/option border-border/60 bg-card text-left hover:border-border flex items-start gap-3 rounded-lg border p-4 transition focus-visible:ring-ring/50 focus-visible:ring-2 focus:outline-none ${
                active ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <option.Icon
                className={`mt-0.5 size-5 shrink-0 ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {option.label}
                  </span>
                  {isCurrent ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[0.6875rem]">
                      Current
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs text-pretty">
                  {option.description}
                </p>
              </div>
            </button>
          )
        })}
      </fieldset>

      {success ? (
        <p className="text-sm text-foreground">{success}</p>
      ) : null}

      {previewLoading ? (
        <p className="text-muted-foreground text-sm">Loading preview…</p>
      ) : null}

      {pending && preview ? (
        <div className="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">Review the change</h3>
              <Badge variant="outline" className="text-[0.6875rem]">
                {preview.wouldAggregateCount.toLocaleString()} would aggregate
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs text-pretty">
              Switching to <strong>{pending}</strong> will
              {pending === 'private' ? (
                <> remove aggregate stats from the repo page. Owner-shared conversation links will keep working.</>
              ) : (
                <>
                  {' '}show aggregate stats for these conversations on
                  <code className="bg-muted mx-1 rounded px-1 py-0.5 font-mono text-[0.6875rem]">
                    howi.cc/r/{owner}/{name}
                  </code>
                  — only ones already marked public by their owners. Private
                  conversations stay private.
                </>
              )}
            </p>
          </div>

          {preview.items.length > 0 ? (
            <ul role="list" className="max-h-64 overflow-auto pr-1">
              {preview.items.slice(0, 50).map((item: RepoVisibilityPreviewItem) => (
                <li
                  key={item.conversationId}
                  className="border-border/60 flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                >
                  <span className="min-w-0 truncate">{item.title}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {item.visibility} · {item.ownerName ?? item.ownerUserId}
                  </span>
                </li>
              ))}
              {preview.items.length > 50 ? (
                <li className="text-muted-foreground py-2 text-xs">
                  + {preview.items.length - 50} more…
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No conversations would be affected.
            </p>
          )}

          <Separator />

          <label
            htmlFor="confirm-visibility-change"
            className="flex cursor-pointer items-center gap-3 text-sm"
          >
            <Checkbox
              id="confirm-visibility-change"
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <span className="text-pretty">
              I've reviewed the affected conversations and confirm the change.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetPreview} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!confirmed || submitting}
            >
              {submitting ? 'Applying…' : `Set to ${pending}`}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}
