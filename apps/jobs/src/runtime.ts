import { type JobsRuntimeInput, type JobsWorkerBindings, extractJobsRuntimeEnv } from './bindings'
import { createJobsEnv } from './env'

export const createJobsRuntime = (input: JobsRuntimeInput) => ({
  env: createJobsEnv(extractJobsRuntimeEnv(input)),
  bindings: {
    DB: input.DB,
    ASSETS: input.ASSETS,
    INGEST_QUEUE: input.INGEST_QUEUE,
  } satisfies JobsWorkerBindings,
})

export type JobsRuntime = ReturnType<typeof createJobsRuntime>
