export type AuthenticatedUser = {
  id: string
  githubUserId?: string
  email?: string
  name?: string
}

export type ApiTokenRecord = {
  id: string
  userId: string
  tokenPrefix: string
  tokenHash: string
  createdAt: string
  revokedAt?: string | null
}

export const maskTokenPrefix = (token: string): string => token.slice(0, 8)

export * from './keys'
export * from './server'
