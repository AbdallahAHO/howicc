import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

export type CliAuthBridge = {
  callbackUrl: string
  state: string
  codeVerifier: string
  codeChallenge: string
  waitForCode: (timeoutMs?: number) => Promise<string>
  close: () => Promise<void>
}

export const createCliAuthBridge = async (): Promise<CliAuthBridge> => {
  const state = randomBytes(16).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  let resolveCode: ((value: string) => void) | undefined
  let rejectCode: ((reason?: unknown) => void) | undefined

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')

      if (url.pathname !== '/callback') {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      const returnedState = url.searchParams.get('state')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.statusCode = 400
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(`<h1>CLI Login Failed</h1><p>${error}</p><p>You can close this window.</p>`)
        rejectCode?.(new Error(`CLI login failed: ${error}`))
        return
      }

      if (returnedState !== state || !code) {
        res.statusCode = 400
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end('<h1>CLI Login Failed</h1><p>The returned state or code was invalid.</p><p>You can close this window.</p>')
        rejectCode?.(new Error('CLI login returned an invalid state or missing code.'))
        return
      }

      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<h1>HowiCC CLI Login Complete</h1><p>You can close this tab and return to your terminal.</p>')
      resolveCode?.(code)
    } catch (error) {
      res.statusCode = 500
      res.end('Internal callback error')
      rejectCode?.(error)
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine local CLI callback server address.')
  }

  const callbackUrl = `http://127.0.0.1:${address.port}/callback`

  return {
    callbackUrl,
    state,
    codeVerifier,
    codeChallenge,
    waitForCode: async (timeoutMs = 2 * 60 * 1000) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      try {
        return await Promise.race([
          codePromise,
          new Promise<string>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('Timed out waiting for browser authentication to complete.'))
            }, timeoutMs)

            timeoutId.unref?.()
          }),
        ])
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }
}
