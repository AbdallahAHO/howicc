export type StorageProviderConfig =
  | { provider: 'r2' }
  | {
      provider: 's3-compatible'
      bucketName: string
      region: string
      endpoint?: string
      accessKeyId?: string
      secretAccessKey?: string
    }

export type StorageEnvInput = {
  STORAGE_PROVIDER: 'r2' | 's3-compatible'
  STORAGE_BUCKET_NAME?: string | null
  STORAGE_REGION: string
  STORAGE_ENDPOINT?: string | null
  STORAGE_ACCESS_KEY_ID?: string | null
  STORAGE_SECRET_ACCESS_KEY?: string | null
}

export const resolveStorageProviderConfig = (
  input: StorageEnvInput,
): StorageProviderConfig => {
  if (input.STORAGE_PROVIDER === 'r2') {
    return { provider: 'r2' }
  }

  if (!input.STORAGE_BUCKET_NAME) {
    throw new Error(
      'STORAGE_BUCKET_NAME is required when STORAGE_PROVIDER is set to s3-compatible.',
    )
  }

  return {
    provider: 's3-compatible',
    bucketName: input.STORAGE_BUCKET_NAME,
    region: input.STORAGE_REGION,
    endpoint: input.STORAGE_ENDPOINT ?? undefined,
    accessKeyId: input.STORAGE_ACCESS_KEY_ID ?? undefined,
    secretAccessKey: input.STORAGE_SECRET_ACCESS_KEY ?? undefined,
  }
}
