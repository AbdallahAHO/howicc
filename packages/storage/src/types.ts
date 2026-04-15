export type StorageVisibility = 'private' | 'public'

export type PutObjectInput = {
  key: string
  body: string | Uint8Array | ArrayBuffer | ReadableStream<unknown>
  contentType?: string
  visibility?: StorageVisibility
  metadata?: Record<string, string>
}

export type PutObjectResult = {
  key: string
  contentType?: string
  visibility: StorageVisibility
}

export type GetObjectResult = {
  key: string
  body: ArrayBuffer | Uint8Array | string | null
  contentType?: string
}

export type SignedUrlResult = {
  key: string
  url: string
  expiresInSeconds: number
}

export interface StorageAdapter {
  kind: string
  putObject(input: PutObjectInput): Promise<PutObjectResult>
  getObject(key: string): Promise<GetObjectResult | null>
  deleteObject(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  createUploadUrl?(key: string, options?: { contentType?: string; expiresInSeconds?: number }): Promise<SignedUrlResult>
  createDownloadUrl?(key: string, options?: { expiresInSeconds?: number }): Promise<SignedUrlResult>
}
