import { describe, expect, it } from 'vitest'
import { createApp } from './app'

type OpenApiDocument = {
  paths: Record<string, {
    get?: {
      security?: Array<Record<string, unknown>>
      responses?: Record<string, {
        content?: Record<string, unknown>
      }>
    }
  }>
  components: {
    securitySchemes: Record<string, unknown>
  }
}

describe('openapi document', () => {
  it('includes the profile, repo, and viewer surface with security metadata', async () => {
    const app = createApp()
    const response = await app.request('http://localhost/openapi.json')
    const document = await response.json() as OpenApiDocument

    expect(response.status).toBe(200)
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/profile',
        '/profile/recompute',
        '/repo/{owner}/{name}',
        '/viewer/session',
        '/viewer/protected',
      ]),
    )

    expect(document.components.securitySchemes).toMatchObject({
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
      BrowserSession: {
        type: 'apiKey',
        in: 'cookie',
        name: '__Secure-howicc.session_token',
      },
    })

    expect(document.paths['/profile']?.get?.security).toEqual([
      { BearerAuth: [] },
      { BrowserSession: [] },
    ])
    expect(document.paths['/viewer/protected']?.get?.responses?.['200']?.content).toHaveProperty(
      'text/html',
    )
  })
})
