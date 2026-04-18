import { useCallback, useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Skeleton } from '@howicc/ui-web/skeleton'
import { AlertTriangle, Check, ChevronRight, Copy } from 'lucide-react'
import { createBrowserApiClient } from '../../../lib/api/client'

type Props = {
  apiUrl: string
  conversationId: string
  artifactId: string
  label?: string
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; content: string }
  | { status: 'error'; message: string }

/**
 * Inline artifact drawer for tool-run previews inside BlockActivityGroup.
 *
 * First click → opens + fetches via GET /conversations/:id/artifacts/:id.
 * Subsequent toggles reuse the cached content so the drawer never
 * re-hits the network. Degrades to hidden when either id is missing,
 * which is why the host block passes the ids down conditionally instead
 * of rendering an empty drawer.
 *
 * @example
 * <ArtifactDrawerIsland
 *   client:load
 *   apiUrl={locals.authApiUrl}
 *   conversationId={doc.sharedMeta.conversationId}
 *   artifactId={item.artifactId}
 * />
 */
export const ArtifactDrawerIsland = ({ apiUrl, conversationId, artifactId, label }: Props) => {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<FetchState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  const panelId = `artifact-panel-${artifactId}`

  const fetchArtifact = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.conversations.getArtifact(conversationId, artifactId)

      if (response && typeof response === 'object' && 'success' in response && response.success === true) {
        setState({ status: 'loaded', content: (response as { content: string }).content ?? '' })
        return
      }

      const errorMessage =
        response && typeof response === 'object' && 'error' in response && typeof response.error === 'string'
          ? response.error
          : 'Could not load artifact.'
      setState({ status: 'error', message: errorMessage })
    } catch (error) {
      console.error(error)
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not load artifact.',
      })
    }
  }, [apiUrl, conversationId, artifactId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && state.status === 'idle') {
      void fetchArtifact()
    }
  }

  const retry = () => {
    void fetchArtifact()
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
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>{open ? 'Hide' : 'Open'} artifact</span>
        {label ? <span className="text-muted-foreground/80 font-normal">· {label}</span> : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={label ? `Artifact ${label}` : 'Artifact content'}
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
            state.content.length === 0 ? (
              <p className="text-muted-foreground p-3 text-xs italic">
                This artifact has no preview content.
              </p>
            ) : (
              <div className="relative">
                <div className="absolute top-1 right-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={copy}
                    aria-label="Copy artifact content"
                  >
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  </Button>
                </div>
                <pre className="text-foreground max-h-96 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
                  <code>{state.content}</code>
                </pre>
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default ArtifactDrawerIsland
