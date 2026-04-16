export type WebAuthUser = {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified?: boolean
  createdAt?: string
  updatedAt?: string
  isAnonymous?: boolean
}

export type WebAuthSession = {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  token: string
}

export type WebAuthState = {
  user: WebAuthUser | null
  session: WebAuthSession | null
  status: 'authenticated' | 'anonymous' | 'unauthenticated'
}

export type WebLocals = {
  auth: WebAuthState
  authApiUrl: string
  runtimeApiUrl: string
  siteUrl: string
  productName: string
}
