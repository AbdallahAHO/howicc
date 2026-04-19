import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readConfig = relativePath =>
  JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'))

const apiConfig = readConfig('apps/api/wrangler.jsonc')
const jobsConfig = readConfig('apps/jobs/wrangler.jsonc')

const failures = []

const apiDatabase = apiConfig.d1_databases?.find(binding => binding.binding === 'DB')
const jobsDatabase = jobsConfig.d1_databases?.find(binding => binding.binding === 'DB')
const apiAssetsBucket = apiConfig.r2_buckets?.find(binding => binding.binding === 'ASSETS')
const jobsAssetsBucket = jobsConfig.r2_buckets?.find(binding => binding.binding === 'ASSETS')
const apiQueue = apiConfig.queues?.producers?.find(binding => binding.binding === 'INGEST_QUEUE')
const jobsQueue = jobsConfig.queues?.consumers?.[0]

const expectEqual = (label, left, right) => {
  if (left !== right) {
    failures.push(`${label} mismatch: api=${JSON.stringify(left)} jobs=${JSON.stringify(right)}`)
  }
}

if (!apiDatabase || !jobsDatabase) {
  failures.push('Missing DB binding in API or jobs wrangler config.')
} else {
  expectEqual('DB database_name', apiDatabase.database_name, jobsDatabase.database_name)
  expectEqual('DB database_id', apiDatabase.database_id, jobsDatabase.database_id)
}

if (!apiAssetsBucket || !jobsAssetsBucket) {
  failures.push('Missing ASSETS bucket binding in API or jobs wrangler config.')
} else {
  expectEqual('ASSETS bucket_name', apiAssetsBucket.bucket_name, jobsAssetsBucket.bucket_name)
}

if (!apiQueue || !jobsQueue) {
  failures.push('Missing ingest queue binding in API or jobs wrangler config.')
} else {
  expectEqual('INGEST queue', apiQueue.queue, jobsQueue.queue)
}

expectEqual('API_BASE_URL var', apiConfig.vars?.API_BASE_URL, jobsConfig.vars?.API_BASE_URL)
expectEqual('APP_ENV var', apiConfig.vars?.APP_ENV, jobsConfig.vars?.APP_ENV)
expectEqual('DB_PROVIDER var', apiConfig.vars?.DB_PROVIDER, jobsConfig.vars?.DB_PROVIDER)
expectEqual('STORAGE_PROVIDER var', apiConfig.vars?.STORAGE_PROVIDER, jobsConfig.vars?.STORAGE_PROVIDER)

if (failures.length > 0) {
  console.error('Cloudflare worker bindings drifted between API and jobs configs:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Cloudflare API/jobs bindings are aligned.')
