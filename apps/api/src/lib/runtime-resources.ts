import { createD1DatabaseAdapter } from '@howicc/db/adapters/d1'
import { createR2StorageAdapter } from '@howicc/storage/adapters/r2'
import type { ApiRuntime } from '../runtime'

export const getRuntimeDatabase = (runtime: ApiRuntime) => {
  if (!runtime.bindings.DB) {
    throw new Error('D1 binding is not configured for the API runtime.')
  }

  return createD1DatabaseAdapter(runtime.bindings.DB as never).db
}

export const getRuntimeStorage = (runtime: ApiRuntime) => {
  if (!runtime.bindings.ASSETS) {
    throw new Error('R2 assets binding is not configured for the API runtime.')
  }

  return createR2StorageAdapter(runtime.bindings.ASSETS as never)
}
