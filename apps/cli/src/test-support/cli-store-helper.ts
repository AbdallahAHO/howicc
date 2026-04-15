import { fileURLToPath, pathToFileURL } from 'node:url'

const configStoreModuleUrl = pathToFileURL(
  fileURLToPath(new URL('../config/store.ts', import.meta.url)),
).href
const claudeLibModuleUrl = pathToFileURL(
  fileURLToPath(new URL('../lib/claude.ts', import.meta.url)),
).href

export const buildCliStoreHelperScript = () => `
import { CliConfigStore } from ${JSON.stringify(configStoreModuleUrl)}
import {
  buildDiscoveredSessionKey,
  buildSessionSourceRevisionHashIndex,
  discoverClaudeSessions,
} from ${JSON.stringify(claudeLibModuleUrl)}

const store = new CliConfigStore()
const action = process.argv[2]
const payload = process.argv[3] ? JSON.parse(process.argv[3]) : undefined

const run = async () => {
  if (action === 'seed-auth') {
    store.setAuthToken(payload)
    console.log(JSON.stringify(store.getAll()))
    return
  }

  if (action === 'get-synced-revisions') {
    console.log(JSON.stringify(store.getSyncedRevisions()))
    return
  }

  if (action === 'seed-synced-session') {
    const sessions = await discoverClaudeSessions()
    const target = sessions.find(session => session.sessionId === payload?.sessionId)

    if (!target) {
      throw new Error(\`Session \${payload?.sessionId} was not found in local Claude storage.\`)
    }

    const revisionHashIndex = await buildSessionSourceRevisionHashIndex([target])
    const sourceRevisionHash = revisionHashIndex.get(buildDiscoveredSessionKey(target))

    if (!sourceRevisionHash) {
      throw new Error(\`Could not compute a revision hash for session \${target.sessionId}.\`)
    }

    store.setSyncedRevision({
      provider: target.provider,
      sessionId: target.sessionId,
      conversationId: payload.conversationId,
      revisionId: payload.revisionId,
      syncedAt: payload.syncedAt,
      sourceRevisionHash,
    })

    console.log(JSON.stringify({ sourceRevisionHash }))
    return
  }

  throw new Error(\`Unknown store helper action: \${action}\`)
}

run().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
`
