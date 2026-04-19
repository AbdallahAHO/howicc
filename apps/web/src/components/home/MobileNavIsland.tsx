import { Button } from '@howicc/ui-web/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@howicc/ui-web/dropdown-menu'
import { Menu } from 'lucide-react'

export const MobileNavIsland = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
            className="touch-target"
          >
            <Menu aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Navigate</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<a href="/home">Home</a>} />
          <DropdownMenuItem render={<a href="/sessions">Sessions</a>} />
          <DropdownMenuItem render={<a href="/insights">Insights</a>} />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/settings">Settings</a>} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default MobileNavIsland
