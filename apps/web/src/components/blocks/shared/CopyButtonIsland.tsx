import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Check, Copy } from 'lucide-react'

type Props = {
  value: string
  ariaLabel?: string
}

export const CopyButtonIsland = ({ value, ariaLabel }: Props) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      aria-label={ariaLabel ?? 'Copy'}
      className="touch-target"
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  )
}

export default CopyButtonIsland
