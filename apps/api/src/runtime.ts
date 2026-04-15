import { type ApiRuntimeInput, type ApiWorkerBindings, extractStringRuntimeEnv } from './bindings'
import { createApiEnv } from './env'

export const createApiRuntime = (input: ApiRuntimeInput) => ({
  env: createApiEnv(extractStringRuntimeEnv(input)),
  bindings: {
    DB: input.DB,
    ASSETS: input.ASSETS,
    INGEST_QUEUE: input.INGEST_QUEUE,
  } satisfies ApiWorkerBindings,
})

export type ApiRuntime = ReturnType<typeof createApiRuntime>
