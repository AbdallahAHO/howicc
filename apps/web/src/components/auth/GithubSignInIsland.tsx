import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Alert, AlertDescription, AlertTitle } from '@howicc/ui-web/alert'
import { Github, Loader2 } from 'lucide-react'
import { startGithubSignIn } from '../../lib/auth/browser/actions'

type Props = {
  authApiUrl: string
  callbackUrl: string
  label?: string
  size?: 'default' | 'lg'
  className?: string
}

export const GithubSignInIsland = ({
  authApiUrl,
  callbackUrl,
  label = 'Continue with GitHub',
  size = 'lg',
  className,
}: Props) => {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      const redirectUrl = await startGithubSignIn({ authApiUrl, callbackUrl })
      window.location.href = redirectUrl
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'GitHub sign-in could not be started.'
      setError(message)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size={size}
        onClick={handleClick}
        disabled={pending}
        className={className}
        data-icon="inline-start"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Github className="size-4" aria-hidden="true" />
        )}
        {pending ? 'Redirecting to GitHub…' : label}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export default GithubSignInIsland
