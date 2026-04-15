export type JsonRecord = Record<string, unknown>

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

export const asArray = <T = unknown>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : []

export const compact = <T>(values: Array<T | undefined | null | false>): T[] =>
  values.filter((value): value is T => Boolean(value))
