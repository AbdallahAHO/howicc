import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Check, Copy } from 'lucide-react'

type Props = {
  command: string
  label?: string
}

export const CopyCommandIsland = ({ command, label }: Props) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="group bg-muted/50 text-foreground border-border/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <code className="font-mono text-sm">
        <span className="text-muted-foreground select-none">$ </span>
        {command}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label={label ?? `Copy ${command}`}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  )
}

export default CopyCommandIsland
