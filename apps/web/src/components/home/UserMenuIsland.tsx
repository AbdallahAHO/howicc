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
import { LogOut } from 'lucide-react'
import { createBrowserAuthClient } from '../../lib/auth/client'

type Props = {
  apiUrl: string
  name: string | null
  email: string
  image?: string | null
}

const computeInitials = (source: string) =>
  source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?'

export const UserMenuIsland = ({ apiUrl, name, email, image }: Props) => {
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
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{name ?? 'GitHub user'}</span>
            <span className="text-muted-foreground truncate text-xs">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<a href="/settings">Settings</a>} />
          <DropdownMenuItem disabled>Public profile (Wave D)</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={signOut}
          disabled={pending}
          variant="destructive"
        >
          <LogOut aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenuIsland
