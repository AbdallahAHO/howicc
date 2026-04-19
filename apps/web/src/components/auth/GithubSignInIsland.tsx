import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Alert, AlertDescription, AlertTitle } from '@howicc/ui-web/alert'
import { Loader2 } from 'lucide-react'
import { startGithubSignIn } from '../../lib/auth/browser/actions'

type Props = {
  authApiUrl: string
  callbackUrl: string
  label?: string
  size?: 'default' | 'lg'
  className?: string
}

const GitHubMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

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
          <GitHubMark className="size-4" />
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
