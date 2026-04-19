import { useEffect } from 'react'

type Props = {
  apiUrl: string
  conversationId: string
}

const SEEN_KEY_PREFIX = 'howicc:session-view-seen:'

/**
 * Fire-and-forget view counter island for public shared conversations.
 * The API debounces by viewer/day and suppresses signed-in owner views.
 */
export default function SessionViewRecorderIsland({
  apiUrl,
  conversationId,
}: Props) {
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10)
    const storageKey = `${SEEN_KEY_PREFIX}${conversationId}:${day}`

    try {
      if (sessionStorage.getItem(storageKey)) return
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // Storage can be unavailable; still try once per page load.
    }

    const url = `${apiUrl.replace(/\/+$/, '')}/sessions/${encodeURIComponent(conversationId)}/view`

    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget — view tracking must never surface to the user.
    })
  }, [apiUrl, conversationId])

  return null
}
