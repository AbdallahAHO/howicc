export type JobsWorkerBindings = {
  DB?: unknown
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
}

export type JobsRuntimeInput = JobsWorkerBindings &
  Record<string, string | undefined | unknown>

export const extractJobsRuntimeEnv = (
  input: JobsRuntimeInput,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) =>
      typeof value === 'string' || typeof value === 'undefined'
        ? [[key, value]]
        : [],
    ),
  )
