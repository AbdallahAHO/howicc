import { Avatar, AvatarFallback, AvatarImage } from '@howicc/ui-web/avatar'

type Props = {
  name: string | null
  email: string
  image?: string | null
  size?: 'default' | 'sm' | 'lg'
}

const computeInitials = (source: string) =>
  source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?'

export const AccountAvatar = ({ name, email, image, size = 'default' }: Props) => {
  const displayName = name ?? email
  const initials = computeInitials(displayName)

  return (
    <Avatar size={size}>
      {image ? <AvatarImage src={image} alt={displayName} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

export default AccountAvatar
