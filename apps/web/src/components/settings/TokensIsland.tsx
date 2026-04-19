import { useState } from 'react'
import type {
  ApiTokenSummary,
  CreateApiTokenResponse,
  RevokeApiTokenResponse,
} from '@howicc/contracts'
import { Badge } from '@howicc/ui-web/badge'
import { Button } from '@howicc/ui-web/button'
import { Skeleton } from '@howicc/ui-web/skeleton'
import { AlertTriangle, Check, Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import { createBrowserApiClient } from '../../lib/api/client'
import { unwrapSuccess } from '../../lib/api/unwrap'

type Props = {
  apiUrl: string
  initialTokens: ApiTokenSummary[]
}

type FreshToken = {
  id: string
  tokenPrefix: string
  secret: string
}

const formatRelative = (iso: string): string => {
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
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * CRUD island for the /settings Tokens card. Keeps everything local:
 * list is seeded from SSR (no hydration fetch), create/revoke mutate
 * state optimistically with rollback on failure. A just-minted secret
 * renders in a one-time banner the user can copy; dismissing the
 * banner drops the plaintext from memory.
 */
export const TokensIsland = ({ apiUrl, initialTokens }: Props) => {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>(initialTokens)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [freshToken, setFreshToken] = useState<FreshToken | null>(null)
  const [copied, setCopied] = useState(false)

  const createToken = async () => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.apiTokens.create()
      const envelope = unwrapSuccess<CreateApiTokenResponse>(response)

      if (!envelope) {
        setError('Could not create a new token. Try again.')
        return
      }

      setTokens((current) => [envelope.token, ...current])
      setFreshToken({
        id: envelope.token.id,
        tokenPrefix: envelope.token.tokenPrefix,
        secret: envelope.secret,
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not create a new token.')
    } finally {
      setCreating(false)
    }
  }

  const revokeToken = async (tokenId: string) => {
    if (revokingId) return
    const previous = tokens
    setRevokingId(tokenId)
    setError(null)

    // Optimistic update: mark the row revoked immediately
    const optimisticTimestamp = new Date().toISOString()
    setTokens((current) =>
      current.map((token) =>
        token.id === tokenId ? { ...token, revokedAt: optimisticTimestamp } : token,
      ),
    )

    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.apiTokens.revoke(tokenId)
      const envelope = unwrapSuccess<RevokeApiTokenResponse>(response)
      if (!envelope) {
        setError('Could not revoke this token. Try again.')
        setTokens(previous)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not revoke this token.')
      setTokens(previous)
    } finally {
      setRevokingId(null)
    }
  }

  const copySecret = async () => {
    if (!freshToken) return
    try {
      await navigator.clipboard.writeText(freshToken.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error(err)
    }
  }

  const dismissFresh = () => {
    setFreshToken(null)
    setCopied(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-sm font-medium">Tokens</p>
          <p className="text-muted-foreground text-sm text-pretty">
            Bearer tokens for the <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">howicc</code> CLI and other automation. Minted once, stored as a SHA-256 hash.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={createToken}
          disabled={creating}
          data-icon="inline-start"
          className="touch-target"
        >
          {creating ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" className="size-3.5" />
          )}
          {creating ? 'Creating…' : 'Create token'}
        </Button>
      </header>

      {freshToken ? (
        <aside
          role="status"
          className="border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-xl border p-4 text-sm"
        >
          <div className="flex flex-col gap-1">
            <p className="text-foreground font-medium">Your new token</p>
            <p className="text-muted-foreground text-xs text-pretty">
              Copy it now — this is the only time the secret is shown. It's already active and you can use it as <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.6875rem]">Authorization: Bearer &lt;secret&gt;</code>.
            </p>
          </div>
          <div className="bg-background border-border/60 flex items-center gap-2 overflow-hidden rounded-md border">
            <code className="text-foreground flex-1 overflow-x-auto px-3 py-2 font-mono text-xs select-all">
              {freshToken.secret}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copySecret}
              aria-label="Copy new token secret"
              className="touch-target mr-1 shrink-0"
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={dismissFresh}
              className="touch-target"
            >
              Dismiss
            </Button>
          </div>
        </aside>
      ) : null}

      {error ? (
        <p className="text-destructive inline-flex items-center gap-1.5 text-xs" role="alert">
          <AlertTriangle aria-hidden="true" className="size-3.5" />
          {error}
        </p>
      ) : null}

      {tokens.length === 0 ? (
        <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-xl border border-dashed p-5 text-sm">
          <p className="text-foreground font-medium">No tokens yet.</p>
          <p className="text-muted-foreground text-pretty">
            Create one above or run <code className="bg-background rounded px-1 py-0.5 font-mono text-xs">howicc login</code> from the CLI to mint one via the browser flow.
          </p>
        </div>
      ) : (
        <ul role="list" className="border-border/60 flex flex-col rounded-xl border">
          {tokens.map((token, index) => {
            const revoked = Boolean(token.revokedAt)
            const isRevoking = revokingId === token.id
            return (
              <li
                key={token.id}
                className={[
                  'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
                  index > 0 ? 'border-border/60 border-t' : '',
                ].join(' ')}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                      {token.tokenPrefix}…
                    </code>
                    {revoked ? (
                      <Badge variant="outline" className="text-[0.6875rem]">
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[0.6875rem]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Created <time dateTime={token.createdAt}>{formatRelative(token.createdAt)}</time>
                    {revoked && token.revokedAt ? (
                      <>
                        {' · '}
                        Revoked <time dateTime={token.revokedAt}>{formatRelative(token.revokedAt)}</time>
                      </>
                    ) : null}
                  </p>
                </div>

                {revoked ? (
                  <Skeleton className="hidden h-8 w-20 opacity-0 sm:block" aria-hidden="true" />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => revokeToken(token.id)}
                    disabled={isRevoking}
                    data-icon="inline-start"
                    className="touch-target text-destructive hover:text-destructive"
                  >
                    {isRevoking ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    )}
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default TokensIsland
