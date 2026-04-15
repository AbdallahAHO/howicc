export type DatabaseProviderConfig =
  | { provider: 'd1' }
  | { provider: 'postgres'; connectionString: string }

export type DatabaseEnvInput = {
  DB_PROVIDER: 'd1' | 'postgres'
  DATABASE_URL?: string | null
}

export const resolveDatabaseProviderConfig = (
  input: DatabaseEnvInput,
): DatabaseProviderConfig => {
  if (input.DB_PROVIDER === 'd1') {
    return { provider: 'd1' }
  }

  if (!input.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required when DB_PROVIDER is set to postgres.',
    )
  }

  return {
    provider: 'postgres',
    connectionString: input.DATABASE_URL,
  }
}
