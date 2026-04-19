import { Octokit } from '@octokit/core'
import { RequestError } from '@octokit/request-error'
import { and, eq } from 'drizzle-orm'
import { accounts, repoPermissions } from '@howicc/db/schema'
import type { ApiRuntime } from '../runtime'
import { getRuntimeDatabase } from './runtime-resources'

/**
 * Permission tiers surfaced by GitHub's
 * `GET /repos/:owner/:name/collaborators/:user/permission` endpoint.
 *
 * `none` covers "not a collaborator" and GitHub 404/403 responses alike so
 * call sites can reason about "no permission" as a single sentinel.
 */
export type GithubPermission = 'admin' | 'maintain' | 'write' | 'read' | 'none'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Ordering used for permission comparisons — higher index = more privileged.
 */
const PERMISSION_ORDER: GithubPermission[] = ['none', 'read', 'write', 'maintain', 'admin']

export const permissionAtLeast = (
  actual: GithubPermission,
  required: GithubPermission,
): boolean => PERMISSION_ORDER.indexOf(actual) >= PERMISSION_ORDER.indexOf(required)

const normalizePermission = (raw: string | undefined | null): GithubPermission => {
  switch (raw) {
    case 'admin':
      return 'admin'
    case 'maintain':
      return 'maintain'
    case 'write':
      return 'write'
    case 'read':
      return 'read'
    default:
      return 'none'
  }
}

const loadGithubAccessToken = async (
  runtime: ApiRuntime,
  userId: string,
): Promise<string | null> => {
  const db = getRuntimeDatabase(runtime)
  const rows = await db
    .select({ accessToken: accounts.accessToken })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')))
    .limit(1)

  return rows[0]?.accessToken ?? null
}

const createOctokit = (accessToken: string): Octokit =>
  new Octokit({
    auth: accessToken,
    userAgent: 'howicc-api',
  })

/**
 * Calls the collaborator-permission endpoint through Octokit and collapses
 * network-level failures (404 "not a collaborator", 403 "insufficient scope")
 * into the `none` sentinel so callers never have to reason about HTTP codes.
 */
const fetchPermissionFromGithub = async (
  accessToken: string,
  owner: string,
  name: string,
  login: string,
): Promise<GithubPermission> => {
  const octokit = createOctokit(accessToken)
  try {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/collaborators/{username}/permission',
      {
        owner,
        repo: name,
        username: login,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )
    return normalizePermission(response.data.permission)
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 404 || error.status === 403) return 'none'
    }
    return 'none'
  }
}

/**
 * Resolves the caller's permission on the target repository, caching the
 * result for one hour in `repo_permissions`. Requires that the caller has
 * authenticated with a GitHub OAuth account that has repo access.
 *
 * @example
 *   const permission = await resolveRepoPermission(runtime, {
 *     userId, login: 'abdallahali', owner: 'acme', name: 'web',
 *   })
 *   if (!permissionAtLeast(permission, 'maintain')) return c.json(..., 403)
 */
export const resolveRepoPermission = async (
  runtime: ApiRuntime,
  params: {
    userId: string
    login: string
    owner: string
    name: string
    now?: Date
  },
): Promise<GithubPermission> => {
  const db = getRuntimeDatabase(runtime)
  const now = params.now ?? new Date()

  const cached = await db
    .select({
      permission: repoPermissions.permission,
      checkedAt: repoPermissions.checkedAt,
    })
    .from(repoPermissions)
    .where(
      and(
        eq(repoPermissions.owner, params.owner),
        eq(repoPermissions.name, params.name),
        eq(repoPermissions.userId, params.userId),
      ),
    )
    .limit(1)

  const cachedRow = cached[0]
  if (cachedRow) {
    const age = now.getTime() - cachedRow.checkedAt.getTime()
    if (age < CACHE_TTL_MS) {
      return normalizePermission(cachedRow.permission)
    }
  }

  const accessToken = await loadGithubAccessToken(runtime, params.userId)
  if (!accessToken) return 'none'

  const fresh = await fetchPermissionFromGithub(
    accessToken,
    params.owner,
    params.name,
    params.login,
  )

  await db
    .insert(repoPermissions)
    .values({
      owner: params.owner,
      name: params.name,
      userId: params.userId,
      permission: fresh,
      checkedAt: now,
    })
    .onConflictDoUpdate({
      target: [repoPermissions.owner, repoPermissions.name, repoPermissions.userId],
      set: {
        permission: fresh,
        checkedAt: now,
      },
    })

  return fresh
}

/**
 * Drops the cached permission row — call after events that should force a
 * fresh lookup (e.g., the user signs out and back in with new scopes).
 */
export const invalidateRepoPermission = async (
  runtime: ApiRuntime,
  params: { userId: string; owner: string; name: string },
): Promise<void> => {
  const db = getRuntimeDatabase(runtime)
  await db
    .delete(repoPermissions)
    .where(
      and(
        eq(repoPermissions.owner, params.owner),
        eq(repoPermissions.name, params.name),
        eq(repoPermissions.userId, params.userId),
      ),
    )
}
