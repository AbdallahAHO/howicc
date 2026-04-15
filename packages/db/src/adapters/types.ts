export type DatabaseAdapterKind = 'd1' | 'postgres'

export type DatabaseAdapter<TDb = unknown, TClient = unknown> = {
  kind: DatabaseAdapterKind
  db: TDb
  client: TClient
}
