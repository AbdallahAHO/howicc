import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter, GetObjectResult, PutObjectInput, PutObjectResult } from '../types'

export type S3CompatibleConfig = {
  bucket: string
  region: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
}

export const createS3CompatibleStorageAdapter = (
  config: S3CompatibleConfig,
): StorageAdapter => {
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint
      ? { endpoint: config.endpoint, forcePathStyle: true }
      : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  })

  return {
    kind: 's3-compatible',
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body =
        input.body instanceof ArrayBuffer ? new Uint8Array(input.body) : input.body

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: body as PutObjectCommand['input']['Body'],
          ContentType: input.contentType,
          Metadata: input.metadata,
        }),
      )

      return {
        key: input.key,
        contentType: input.contentType,
        visibility: input.visibility ?? 'private',
      }
    },
    async getObject(key: string): Promise<GetObjectResult | null> {
      const object = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      )

      if (!object.Body) return null

      const bytes = await object.Body.transformToByteArray()

      return {
        key,
        body: bytes,
        contentType: object.ContentType,
      }
    },
    async deleteObject(key: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      )
    },
    async exists(key: string): Promise<boolean> {
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        )
        return true
      } catch {
        return false
      }
    },
    async createUploadUrl(key, options) {
      const expiresInSeconds = options?.expiresInSeconds ?? 600
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: options?.contentType,
        }),
        { expiresIn: expiresInSeconds },
      )

      return { key, url, expiresInSeconds }
    },
    async createDownloadUrl(key, options) {
      const expiresInSeconds = options?.expiresInSeconds ?? 600
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      )

      return { key, url, expiresInSeconds }
    },
  }
}
