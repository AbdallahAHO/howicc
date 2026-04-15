import { useState } from 'react'
import { isApiErrorResponse } from '@howicc/api-client'
import { createBrowserApiClient } from '../../lib/api/client'
import { createBrowserAuthClient } from '../../lib/auth/client'

type Props = {
  apiUrl: string
}

export const AuthActionsIsland = ({ apiUrl }: Props) => {
  const [status, setStatus] = useState<string>('')
  const [protectedHtml, setProtectedHtml] = useState<string>('')
  const [viewerSessionJson, setViewerSessionJson] = useState<string>('')

  const client = createBrowserAuthClient(apiUrl)
  const api = createBrowserApiClient(apiUrl)

  const loadViewerSession = async () => {
    setStatus('Loading viewer session...')

    try {
      const response = await api.viewer.getSession()

      if (!response || isApiErrorResponse(response)) {
        setViewerSessionJson('')
        setStatus(response?.error ?? 'Viewer session request failed.')
        return
      }

      setViewerSessionJson(JSON.stringify(response, null, 2))
      setStatus(response.authenticated ? 'Viewer session loaded.' : 'No active viewer session.')
    } catch (error) {
      console.error(error)
      setViewerSessionJson('')
      setStatus('Viewer session request failed.')
    }
  }

  const tryProtectedRoute = async () => {
    setStatus('Loading protected route...')

    try {
      const response = await api.viewer.getProtectedHtml()
      setProtectedHtml(response.html)
      setStatus(response.ok ? 'Protected route loaded.' : `Protected route returned ${response.status}.`)
    } catch (error) {
      console.error(error)
      setStatus('Protected route request failed.')
    }
  }

  const logout = async () => {
    setStatus('Signing out...')

    try {
      await client.signOut({
        fetchOptions: {
          credentials: 'include',
        },
      })
      window.location.reload()
    } catch (error) {
      console.error(error)
      setStatus('Sign out failed.')
    }
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={loadViewerSession}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.85rem 1.15rem',
            background: '#111827',
            color: 'white',
            borderRadius: '0.75rem',
            border: 'none',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Check Viewer Session
        </button>
        <button
          type="button"
          onClick={tryProtectedRoute}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.85rem 1.15rem',
            background: '#2563eb',
            color: 'white',
            borderRadius: '0.75rem',
            border: 'none',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Try Protected Route
        </button>
        <button
          type="button"
          onClick={logout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.85rem 1.15rem',
            background: 'white',
            color: '#111827',
            borderRadius: '0.75rem',
            border: '1px solid #d1d5db',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <p style={{ marginTop: '1rem', color: '#6b7280' }}>{status}</p>

      {viewerSessionJson ? (
        <pre
          style={{
            marginTop: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '1rem',
            padding: '1.25rem',
            background: '#0f172a',
            color: '#e2e8f0',
            overflowX: 'auto',
            fontSize: '0.9rem',
          }}
        >
          {viewerSessionJson}
        </pre>
      ) : null}

      {protectedHtml ? (
        <div
          style={{
            marginTop: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '1rem',
            padding: '1.25rem',
            background: 'white',
          }}
          dangerouslySetInnerHTML={{ __html: protectedHtml }}
        />
      ) : null}
    </div>
  )
}

export default AuthActionsIsland
