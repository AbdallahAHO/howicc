import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@howicc/ui-web/dropdown-menu'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { createBrowserApiClient } from '../../lib/api/client'

type Visibility = 'private' | 'unlisted' | 'public'

type Props = {
  apiUrl: string
  conversationId: string
  initialVisibility: Visibility
}

const labels: Record<Visibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
}

const descriptions: Record<Visibility, string> = {
  private: 'Only you can see this.',
  unlisted: 'Anyone with the link can see this.',
  public: 'Listed in your public profile.',
}

export const VisibilityMenuIsland = ({
  apiUrl,
  conversationId,
  initialVisibility,
}: Props) => {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const applyVisibility = async (next: string) => {
    if (next !== 'private' && next !== 'unlisted' && next !== 'public') return
    const target = next as Visibility
    if (target === visibility || pending) return

    setPending(true)
    const previous = visibility
    setVisibility(target)

    try {
      const api = createBrowserApiClient(apiUrl)
      const response = await api.conversations.updateVisibility(conversationId, target)
      const succeeded =
        Boolean(response) &&
        typeof response === 'object' &&
        'success' in response &&
        response.success === true
      if (!succeeded) {
        setVisibility(previous)
      }
    } catch (error) {
      console.error(error)
      setVisibility(previous)
    } finally {
      setPending(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyLink}
        data-icon="inline-start"
        className="touch-target"
      >
        {copied ? <Check aria-hidden="true" /> : null}
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              data-icon="inline-end"
              disabled={pending}
              className="touch-target"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : null}
              {labels[visibility]}
              <ChevronDown aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-64">
          <DropdownMenuLabel>Who can see this?</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={visibility} onValueChange={applyVisibility}>
            {(['private', 'unlisted', 'public'] as const).map((option) => (
              <DropdownMenuRadioItem key={option} value={option} className="items-start">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{labels[option]}</span>
                  <span className="text-muted-foreground text-xs">{descriptions[option]}</span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Share settings (Wave B)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default VisibilityMenuIsland
