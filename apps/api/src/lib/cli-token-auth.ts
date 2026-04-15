import { and, eq, isNull } from 'drizzle-orm'
import { apiTokens, users } from '@howicc/db/schema'
import type { ApiRuntime } from '../runtime'
import { getRuntimeDatabase } from './runtime-resources'

export type AuthenticatedCliUser = {
  id: string
  email: string
  name: string
}

export const getBearerToken = (header?: string): string | undefined => {
  if (!header) return undefined
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

export const sha256Hex = async (
  value: string | Uint8Array | ArrayBuffer,
): Promise<string> => {
  const bytes =
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value)

  const input = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', input)

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const binary = String.fromCharCode(...new Uint8Array(digest))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const authenticateCliToken = async (
  runtime: ApiRuntime,
  authorizationHeader?: string,
): Promise<AuthenticatedCliUser | null> => {
  const token = getBearerToken(authorizationHeader)

  if (!token) {
    return null
  }

  const db = getRuntimeDatabase(runtime)
  const rows = await db
    .select({ userId: apiTokens.userId, email: users.email, name: users.name })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(and(eq(apiTokens.tokenHash, await sha256Hex(token)), isNull(apiTokens.revokedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.userId,
    email: row.email,
    name: row.name,
  }
}
