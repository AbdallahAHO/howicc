export type ApiWorkerBindings = {
  DB?: unknown
  ASSETS?: unknown
  INGEST_QUEUE?: unknown
}

export type ApiRuntimeInput = ApiWorkerBindings &
  Record<string, string | undefined | unknown>

export const extractStringRuntimeEnv = (
  input: ApiRuntimeInput,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) =>
      typeof value === 'string' || typeof value === 'undefined'
        ? [[key, value]]
        : [],
    ),
  )
