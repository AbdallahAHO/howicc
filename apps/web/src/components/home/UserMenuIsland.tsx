import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@howicc/ui-web/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@howicc/ui-web/dropdown-menu'
import { createBrowserAuthClient } from '../../lib/auth/client'

type Props = {
  apiUrl: string
  name: string | null
  email: string
  image?: string | null
  /** Present when the user has opted their profile public. Links the dropdown to `/{username}`. */
  publicProfileUrl?: string | null
}

const computeInitials = (source: string) =>
  source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?'

export const UserMenuIsland = ({ apiUrl, name, email, image, publicProfileUrl }: Props) => {
  const [pending, setPending] = useState(false)
  const displayName = name ?? email
  const initials = computeInitials(displayName)

  const signOut = async () => {
    if (pending) return
    setPending(true)
    try {
      const client = createBrowserAuthClient(apiUrl)
      await client.signOut({ fetchOptions: { credentials: 'include' } })
      window.location.href = '/'
    } catch (error) {
      console.error(error)
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="touch-target inline-flex items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {image ? <AvatarImage src={image} alt={displayName} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground truncate text-sm font-medium">
                {name ?? 'GitHub user'}
              </span>
              <span className="text-muted-foreground truncate text-xs font-normal">
                {email}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuGroup>
          {publicProfileUrl ? (
            <DropdownMenuItem render={<a href={publicProfileUrl}>Public profile</a>} />
          ) : null}
          <DropdownMenuItem render={<a href="/settings">Settings</a>} />
          <DropdownMenuItem
            onClick={signOut}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground focus:text-foreground"
          >
            {pending ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenuIsland
