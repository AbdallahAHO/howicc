import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../schema'
import type { DatabaseAdapter } from './types'

export type PostgresDatabase = ReturnType<typeof drizzlePostgres>
export type PostgresClient = postgres.Sql<{}>

export const createPostgresDatabaseAdapter = (
  connectionString: string,
): DatabaseAdapter<PostgresDatabase, PostgresClient> => {
  const client = postgres(connectionString)

  return {
    kind: 'postgres',
    client,
    db: drizzlePostgres(client, { schema }),
  }
}
