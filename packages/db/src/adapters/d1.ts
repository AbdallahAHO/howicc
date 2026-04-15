import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import * as schema from '../schema'
import type { DatabaseAdapter } from './types'

export type D1Client = Parameters<typeof drizzleD1>[0]
export type D1Database = ReturnType<typeof drizzleD1>

export const createD1DatabaseAdapter = (
  client: D1Client,
): DatabaseAdapter<D1Database, D1Client> => ({
  kind: 'd1',
  client,
  db: drizzleD1(client, { schema }),
})
