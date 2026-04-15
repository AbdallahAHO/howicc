import type { StorageAdapter, GetObjectResult, PutObjectInput, PutObjectResult } from '../types'

export type R2ObjectBodyLike = {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

export type R2BucketLike = {
  put(
    key: string,
    value: PutObjectInput['body'],
    options?: {
      httpMetadata?: { contentType?: string }
      customMetadata?: Record<string, string>
    },
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectBodyLike | null>
  head(key: string): Promise<{ size?: number } | null>
  delete(key: string): Promise<void>
}

export const createR2StorageAdapter = (
  bucket: R2BucketLike,
): StorageAdapter => ({
  kind: 'r2',
  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    await bucket.put(input.key, input.body, {
      httpMetadata: input.contentType
        ? { contentType: input.contentType }
        : undefined,
      customMetadata: input.metadata,
    })

    return {
      key: input.key,
      contentType: input.contentType,
      visibility: input.visibility ?? 'private',
    }
  },
  async getObject(key: string): Promise<GetObjectResult | null> {
    const object = await bucket.get(key)
    if (!object) return null

    return {
      key,
      body: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType,
    }
  },
  async deleteObject(key: string): Promise<void> {
    await bucket.delete(key)
  },
  async exists(key: string): Promise<boolean> {
    const head = await bucket.head(key)
    return head !== null
  },
})
