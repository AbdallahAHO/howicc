import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../../../apps/api/src/app'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(scriptDir, '..')
const outputPath = resolve(packageDir, 'openapi/howicc-openapi.json')

const response = await createApp().request('http://localhost/openapi.json')

if (!response.ok) {
  throw new Error(`Expected /openapi.json to return 200 but received ${response.status}.`)
}

const document = await response.json()

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`)

console.log(`Wrote ${outputPath}`)
