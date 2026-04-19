import { useCallback, useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Skeleton } from '@howicc/ui-web/skeleton'
import { AlertTriangle, Check, ChevronRight, Copy } from 'lucide-react'
import { createBrowserApiClient } from '../../../lib/api/client'

type DrawerKind = 'artifact' | 'asset'

type Props = {
  apiUrl: string
  conversationId: string
  kind: DrawerKind
  id: string
  label?: string
  openLabel?: string
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; content: string; meta?: string }
  | { status: 'error'; message: string }

/**
 * Inline text-preview drawer for artifact ids (tool runs) and asset ids
 * (resource blocks). One component, two kinds — keeps the UI identical
 * (fetch on first open, cache for subsequent toggles, copy action, a11y
 * with `aria-expanded` + `aria-controls`) and just swaps the API method.
 *
 * Degrades to hidden when `conversationId` is missing, which is why
 * host blocks gate rendering on the presence of the id before mounting
 * this island.
 *
 * @example
 * <ContentDrawerIsland
 *   client:load
 *   apiUrl={locals.authApiUrl}
 *   conversationId={doc.sharedMeta.conversationId}
 *   kind="asset"
 *   id={block.assetId}
 *   label={block.server}
 * />
 */
export const ContentDrawerIsland = ({
  apiUrl,
  conversationId,
  kind,
  id,
  label,
  openLabel,
}: Props) => {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<FetchState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  const panelId = `drawer-panel-${kind}-${id}`
  const kindLabel = kind === 'artifact' ? 'artifact' : 'asset'
  const buttonCopy = openLabel ?? kindLabel

  const fetchContent = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const api = createBrowserApiClient(apiUrl)
      const response =
        kind === 'artifact'
          ? await api.conversations.getArtifact(conversationId, id)
          : await api.conversations.getAsset(conversationId, id)

      if (
        response &&
        typeof response === 'object' &&
        'success' in response &&
        (response as { success: boolean }).success === true
      ) {
        const body = response as {
          content: string
          kind?: string
          mimeType?: string
          bytes?: number
          relPath?: string
        }
        const metaBits = [body.kind, body.mimeType, body.relPath].filter(
          (part): part is string => typeof part === 'string' && part.length > 0,
        )
        setState({
          status: 'loaded',
          content: body.content ?? '',
          meta: metaBits.length > 0 ? metaBits.join(' · ') : undefined,
        })
        return
      }

      const errorMessage =
        response && typeof response === 'object' && 'error' in response && typeof response.error === 'string'
          ? response.error
          : `Could not load ${kindLabel}.`
      setState({ status: 'error', message: errorMessage })
    } catch (error) {
      console.error(error)
      setState({
        status: 'error',
        message:
          error instanceof Error ? error.message : `Could not load ${kindLabel}.`,
      })
    }
  }, [apiUrl, conversationId, id, kind, kindLabel])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && state.status === 'idle') {
      void fetchContent()
    }
  }

  const retry = () => {
    void fetchContent()
  }

  const copy = async () => {
    if (state.status !== 'loaded') return
    try {
      await navigator.clipboard.writeText(state.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="border-border/60 bg-background flex flex-col overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-muted-foreground hover:text-foreground touch-target flex items-center gap-2 px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>
          {open ? 'Hide' : 'Open'} {buttonCopy}
        </span>
        {label ? <span className="text-muted-foreground/80 font-normal">· {label}</span> : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={label ? `${kindLabel} ${label}` : `${kindLabel} content`}
          className="border-border/60 flex flex-col border-t"
        >
          {state.status === 'loading' ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : state.status === 'error' ? (
            <div className="flex items-center justify-between gap-3 p-3 text-xs">
              <div className="text-destructive flex items-center gap-2">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                <span>{state.message}</span>
              </div>
              <Button type="button" variant="outline" size="xs" onClick={retry}>
                Retry
              </Button>
            </div>
          ) : state.status === 'loaded' ? (
            <>
              {state.meta ? (
                <p className="text-muted-foreground border-border/40 border-b px-3 py-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
                  {state.meta}
                </p>
              ) : null}
              {state.content.length === 0 ? (
                <p className="text-muted-foreground p-3 text-xs italic">
                  This {kindLabel} has no preview content.
                </p>
              ) : (
                <div className="relative">
                  <div className="absolute top-1 right-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={copy}
                      aria-label={`Copy ${kindLabel} content`}
                      className="touch-target"
                    >
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </Button>
                  </div>
                  <pre className="text-foreground max-h-96 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
                    <code>{state.content}</code>
                  </pre>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default ContentDrawerIsland
