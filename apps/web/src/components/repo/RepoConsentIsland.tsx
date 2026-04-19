import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@howicc/ui-web/alert'
import { Button } from '@howicc/ui-web/button'
import { Checkbox } from '@howicc/ui-web/checkbox'
import { Label } from '@howicc/ui-web/label'
import { ShieldAlert } from 'lucide-react'

type Props = {
  apiUrl: string
  owner: string
  name: string
  hiddenCount: number
  publicSessionCount: number
}

export default function RepoConsentIsland({
  apiUrl,
  owner,
  name,
  hiddenCount,
  publicSessionCount,
}: Props) {
  const [acknowledgedPrivate, setAcknowledgedPrivate] = useState(false)
  const [willNotExpose, setWillNotExpose] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = acknowledgedPrivate && willNotExpose && !submitting

  const handleConfirm = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/+$/, '')}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/consent`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledged: true }),
        },
      )
      if (!response.ok) throw new Error(`Consent failed with ${response.status}`)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save consent.')
      setSubmitting(false)
    }
  }

  return (
    <Alert variant="destructive" className="border-destructive/40">
      <ShieldAlert className="size-5" />
      <AlertTitle className="text-base">
        Acknowledge the private-repo notice
      </AlertTitle>
      <AlertDescription>
        <p className="mb-4">
          This repo is marked <strong>private</strong> on HowiCC. Aggregate
          stats at <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">howi.cc/r/{owner}/{name}</code>
          {' '}are hidden from everyone except repo admins. Individual
          conversations remain under their owners' control — this page
          cannot make a private conversation public.
        </p>
        <dl className="border-border/60 mb-5 grid grid-cols-2 gap-3 rounded-lg border bg-background/60 p-3 text-foreground">
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Public sessions</dt>
            <dd className="text-lg font-semibold tabular-nums">{publicSessionCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Hidden by admin</dt>
            <dd className="text-lg font-semibold tabular-nums">{hiddenCount.toLocaleString()}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="consent-ack-private"
            className="flex items-start gap-3 rounded-md p-2 text-sm text-foreground transition hover:bg-muted/40"
          >
            <Checkbox
              id="consent-ack-private"
              checked={acknowledgedPrivate}
              onCheckedChange={(checked) =>
                setAcknowledgedPrivate(checked === true)
              }
            />
            <span className="text-pretty">
              I understand this repo contains conversations that other users
              have chosen not to aggregate publicly.
            </span>
          </label>

          <label
            htmlFor="consent-ack-discuss"
            className="flex items-start gap-3 rounded-md p-2 text-sm text-foreground transition hover:bg-muted/40"
          >
            <Checkbox
              id="consent-ack-discuss"
              checked={willNotExpose}
              onCheckedChange={(checked) => setWillNotExpose(checked === true)}
            />
            <span className="text-pretty">
              I will not change visibility without reviewing the affected
              conversations and discussing with the team.
            </span>
          </label>
        </div>

        {error ? (
          <p className="text-destructive mt-3 text-xs">{error}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = `/r/${owner}/${name}`
            }}
            disabled={submitting}
          >
            Back to repo
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Acknowledge and continue'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

export { RepoConsentIsland }
// Label re-export keeps the component surface explicit for any future
// caller that wants to align with shadcn patterns.
export { Label }
