import { useEffect } from 'react'

type Props = {
  apiUrl: string
  username: string
}

const SEEN_KEY_PREFIX = 'howicc:profile-view-seen:'

/**
 * Fire-and-forget view counter island. Mounts on idle for non-owner visits
 * to `/:username` and pings the API once per day per visitor per profile.
 * Own-profile views are filtered server-side as an extra safeguard; this
 * island is also only rendered when the viewer isn't the owner.
 */
export default function ProfileViewRecorderIsland({ apiUrl, username }: Props) {
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10)
    const storageKey = `${SEEN_KEY_PREFIX}${username}:${day}`

    try {
      if (sessionStorage.getItem(storageKey)) return
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // Private browsing / storage disabled — still try to record once per page load.
    }

    const url = `${apiUrl.replace(/\/+$/, '')}/profile/public/${encodeURIComponent(username)}/view`

    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget — network failures must never surface to the user.
    })
  }, [apiUrl, username])

  return null
}
