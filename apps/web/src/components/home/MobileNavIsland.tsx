import { Button } from '@howicc/ui-web/button'
import {
  DropdownMenu,
  DropdownMenuContent,
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
        <DropdownMenuLabel>Navigate</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/home">Home</a>} />
        <DropdownMenuItem disabled>Sessions (Wave B)</DropdownMenuItem>
        <DropdownMenuItem disabled>Insights (Wave D)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default MobileNavIsland
