import { ApiPaths, ConversationVisibility, UploadAssetKind } from './generated/openapi'
import {
  createApiFetchClient,
  type ApiClientConfig,
  type ApiFetchClient,
} from './fetch-client'

type FetchResult<TData, TError> = Promise<
  | { data: TData; error?: never; response: Response }
  | { data?: never; error: TError; response: Response }
>

type SettledFetchResult<TData, TError> =
  | { ok: true; status: number; data: TData; response: Response }
  | { ok: false; status: number; error: TError; response: Response }

export type ApiHtmlResult = {
  ok: boolean
  status: number
  html: string
}

type UploadAssetKindValue = `${UploadAssetKind}`

type ConversationVisibilityValue = `${ConversationVisibility}`

const toConversationVisibility = (value: ConversationVisibilityValue) =>
  value as ConversationVisibility

const settleFetchResult = async <TData, TError>(
  request: FetchResult<TData, TError>,
): Promise<SettledFetchResult<TData, TError>> => {
  const { data, error, response } = await request

  if (error !== undefined) {
    return {
      ok: false,
      status: response.status,
      error: error as TError,
      response,
    }
  }

  return {
    ok: true,
    status: response.status,
    data: data as TData,
    response,
  }
}

const unwrapFetchResult = async <TData, TError>(
  request: FetchResult<TData, TError>,
): Promise<TData | TError> => {
  const result = await settleFetchResult(request)

  return (result.ok ? result.data : result.error) as TData | TError
}

const toUploadAssetKind = (kind: UploadAssetKindValue) =>
  kind as UploadAssetKind

const createUploadsApi = (
  fetchClient: ApiFetchClient,
  config: ApiClientConfig,
) => ({
  createSession: (body: {
    sourceRevisionHash: string
    assets: Array<{
      kind: UploadAssetKindValue
      bytes: number
      sha256: string
    }>
  }) =>
    unwrapFetchResult(
      fetchClient.POST(ApiPaths.createUploadSession, {
        body: {
          ...body,
          assets: body.assets.map(asset => ({
            ...asset,
            kind: toUploadAssetKind(asset.kind),
          })),
        },
      }),
    ),
  uploadAsset: (input: {
    uploadId: string
    kind: UploadAssetKindValue
    body: Uint8Array | ArrayBuffer
    contentType?: string
  }) =>
    uploadRevisionAsset(config, input),
  finalize: (body: {
    uploadId: string
    sourceRevisionHash: string
    conversationId?: string
    sourceApp: string
    sourceSessionId: string
    sourceProjectKey: string
    title: string
    assets: Array<{
      kind: UploadAssetKindValue
      key: string
      sha256: string
      bytes: number
    }>
  }) =>
    unwrapFetchResult(
      fetchClient.POST(ApiPaths.finalizeUploadRevision, {
        body: {
          ...body,
          assets: body.assets.map(asset => ({
            ...asset,
            kind: toUploadAssetKind(asset.kind),
          })),
        },
      }),
    ),
})

/**
 * Creates the domain-oriented HowiCC API client.
 *
 * This wraps the generated OpenAPI fetch client in a stable surface that is easier to consume
 * from the CLI, the web app, and scripts without losing typed request or response data.
 *
 * @example
 * ```ts
 * const api = createApiClient({
 *   baseUrl: 'https://api.howi.cc',
 *   getToken: async () => token,
 * })
 *
 * const session = await api.viewer.getSession()
 * const profile = await api.profile.get()
 * ```
 */
export const createApiClient = (config: ApiClientConfig) => {
  const fetchClient = createApiFetchClient(config)

  return {
    fetchClient,
    health: {
      check: () => unwrapFetchResult(fetchClient.GET(ApiPaths.getHealth)),
    },
    uploads: createUploadsApi(fetchClient, config),
    conversations: {
      list: () => unwrapFetchResult(fetchClient.GET(ApiPaths.listConversations)),
      getRenderDocument: (conversationId: string) =>
        unwrapFetchResult(
          fetchClient.GET(ApiPaths.getConversationRenderDocument, {
            params: {
              path: {
                conversationId,
              },
            },
          }),
        ),
      getShared: (slug: string) =>
        unwrapFetchResult(
          fetchClient.GET(ApiPaths.getSharedRenderDocument, {
            params: {
              path: { slug },
            },
          }),
        ),
      updateVisibility: (
        conversationId: string,
        visibility: ConversationVisibilityValue,
      ) =>
        unwrapFetchResult(
          fetchClient.PATCH(ApiPaths.updateConversationVisibility, {
            params: {
              path: { conversationId },
            },
            body: { visibility: toConversationVisibility(visibility) },
          }),
        ),
      getArtifact: (conversationId: string, artifactId: string) =>
        unwrapFetchResult(
          fetchClient.GET(ApiPaths.getConversationArtifact, {
            params: {
              path: {
                artifactId,
                conversationId,
              },
            },
          }),
        ),
    },
    pricing: {
      getModels: () => unwrapFetchResult(fetchClient.GET(ApiPaths.listPricingModels)),
    },
    profile: {
      get: () => unwrapFetchResult(fetchClient.GET(ApiPaths.getProfile)),
      stats: () => unwrapFetchResult(fetchClient.GET(ApiPaths.getProfileStats)),
      activity: (query?: { cursor?: string; limit?: number }) =>
        unwrapFetchResult(
          fetchClient.GET(ApiPaths.getProfileActivity, {
            params: {
              query: {
                ...(query?.cursor !== undefined ? { cursor: query.cursor } : {}),
                ...(query?.limit !== undefined ? { limit: String(query.limit) } : {}),
              },
            },
          }),
        ),
      recompute: () =>
        unwrapFetchResult(fetchClient.POST(ApiPaths.recomputeProfile)),
    },
    repo: {
      get: (owner: string, name: string) =>
        unwrapFetchResult(
          fetchClient.GET(ApiPaths.getRepoProfile, {
            params: {
              path: {
                owner,
                name,
              },
            },
          }),
        ),
    },
    viewer: {
      getSession: () => unwrapFetchResult(fetchClient.GET(ApiPaths.getViewerSession)),
      getProtectedHtml: async (): Promise<ApiHtmlResult> => {
        const result = await settleFetchResult(
          fetchClient.GET(ApiPaths.getViewerProtected, {
            parseAs: 'text',
          }),
        )

        if (result.ok) {
          return {
            ok: true,
            status: result.status,
            html: result.data ?? '',
          }
        }

        return {
          ok: false,
          status: result.status,
          html: result.error ?? '',
        }
      },
    },
    cliAuth: {
      authorize: (body: {
        callbackUrl: string
        codeChallenge: string
        state: string
      }) =>
        unwrapFetchResult(
          fetchClient.POST(ApiPaths.authorizeCliSession, {
            body,
          }),
        ),
      exchange: (body: { code: string; codeVerifier: string }) =>
        unwrapFetchResult(
          fetchClient.POST(ApiPaths.exchangeCliGrant, {
            body,
          }),
        ),
      whoami: () => unwrapFetchResult(fetchClient.GET(ApiPaths.getCliTokenOwner)),
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

const uploadRevisionAsset = async (
  config: ApiClientConfig,
  input: {
    uploadId: string
    kind: UploadAssetKindValue
    body: Uint8Array | ArrayBuffer
    contentType?: string
  },
) => {
  const token = await config.getToken?.()
  const headers = new Headers(config.headers)

  headers.set('Content-Type', input.contentType ?? 'application/octet-stream')

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await (config.fetch ?? fetch)(
    buildUploadAssetUrl(config.baseUrl, input.uploadId, input.kind),
    {
      method: 'PUT',
      headers,
      credentials: config.credentials,
      body: input.body instanceof Uint8Array
        ? Uint8Array.from(input.body)
        : new Uint8Array(input.body),
    },
  )

  const payload = await response.json()

  return payload as Record<string, unknown>
}

const buildUploadAssetUrl = (
  baseUrl: string,
  uploadId: string,
  kind: UploadAssetKindValue,
) =>
  `${baseUrl.replace(/\/+$/, '')}${ApiPaths.uploadRevisionAsset
    .replace('{uploadId}', encodeURIComponent(uploadId))
    .replace('{kind}', encodeURIComponent(kind))}`
