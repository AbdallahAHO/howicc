import { useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Alert, AlertDescription, AlertTitle } from '@howicc/ui-web/alert'
import { Loader2, LogOut } from 'lucide-react'
import { createBrowserAuthClient } from '../../lib/auth/client'

type Props = {
  apiUrl: string
}

export const AuthActionsIsland = ({ apiUrl }: Props) => {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = createBrowserAuthClient(apiUrl)

  const logout = async () => {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      await client.signOut({
        fetchOptions: { credentials: 'include' },
      })
      window.location.href = '/'
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Sign out failed.')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={logout}
        disabled={pending}
        data-icon="inline-start"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="size-4" aria-hidden="true" />
        )}
        {pending ? 'Signing out…' : 'Sign out'}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Sign-out failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export default AuthActionsIsland
