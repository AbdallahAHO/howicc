import { createHash, randomBytes } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'

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
        respondWithPage(res, 400, {
          variant: 'error',
          title: 'CLI login failed',
          message: error,
        })
        rejectCode?.(new Error(`CLI login failed: ${error}`))
        return
      }

      if (returnedState !== state || !code) {
        respondWithPage(res, 400, {
          variant: 'error',
          title: 'CLI login failed',
          message: 'The returned state or code was invalid. Please run the command again.',
        })
        rejectCode?.(new Error('CLI login returned an invalid state or missing code.'))
        return
      }

      respondWithPage(res, 200, {
        variant: 'success',
        title: "You're all set",
        message: 'The CLI on your machine is now signed in. You can close this tab and return to your terminal.',
      })
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

type CallbackPageState = {
  variant: 'success' | 'error'
  title: string
  message: string
}

const respondWithPage = (
  res: ServerResponse,
  statusCode: number,
  state: CallbackPageState,
) => {
  res.statusCode = statusCode
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(renderCallbackPage(state))
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })

const renderCallbackPage = (state: CallbackPageState): string => {
  const isSuccess = state.variant === 'success'
  const accent = isSuccess ? 'oklch(0.6387 0.2151 36.46)' : 'oklch(0.637 0.237 25.331)'
  const accentSoft = isSuccess
    ? 'rgba(193, 95, 60, 0.10)'
    : 'rgba(216, 64, 64, 0.10)'
  const icon = isSuccess
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></svg>'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(state.title)} · HowiCC</title>
  <style>
    :root {
      color-scheme: light dark;
      --background: oklch(1 0 0);
      --foreground: oklch(0.141 0.005 285.823);
      --card: oklch(1 0 0);
      --muted-foreground: oklch(0.552 0.016 285.938);
      --border: oklch(0.92 0.004 286.32);
      --accent: ${accent};
      --accent-soft: ${accentSoft};
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: oklch(0.141 0.005 285.823);
        --foreground: oklch(0.985 0 0);
        --card: oklch(0.21 0.006 285.885);
        --muted-foreground: oklch(0.705 0.015 286.067);
        --border: oklch(1 1 1 / 10%);
      }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--background);
      color: var(--foreground);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      background-image: radial-gradient(ellipse at top, var(--accent-soft) 0%, transparent 62%);
      background-repeat: no-repeat;
    }
    main {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 2rem 1.25rem;
    }
    .card {
      width: 100%;
      max-width: 28rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2.25rem;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.12);
      text-align: center;
      animation: rise 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .icon {
      width: 3.25rem;
      height: 3.25rem;
      margin: 0 auto 1.25rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .icon svg { width: 1.5rem; height: 1.5rem; }
    .brand {
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted-foreground);
      margin: 0 0 0.5rem;
    }
    h1 {
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      font-weight: 500;
      font-size: 1.75rem;
      letter-spacing: -0.015em;
      line-height: 1.15;
      margin: 0 0 0.75rem;
      text-wrap: balance;
    }
    p {
      color: var(--muted-foreground);
      margin: 0;
      text-wrap: pretty;
    }
    .hint {
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      font-size: 0.8125rem;
      color: var(--muted-foreground);
    }
    .hint kbd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.75rem;
      padding: 0.125rem 0.375rem;
      border: 1px solid var(--border);
      border-radius: 0.375rem;
      background: var(--background);
    }
  </style>
</head>
<body>
  <main>
    <div class="card" role="status">
      <div class="icon">${icon}</div>
      <p class="brand">HowiCC CLI</p>
      <h1>${escapeHtml(state.title)}</h1>
      <p>${escapeHtml(state.message)}</p>
      <p class="hint">Close this tab with <kbd>${process.platform === 'darwin' ? '⌘' : 'Ctrl'}</kbd> + <kbd>W</kbd></p>
    </div>
  </main>
</body>
</html>`
}

