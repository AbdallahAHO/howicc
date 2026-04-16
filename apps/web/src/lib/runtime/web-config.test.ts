import { describe, expect, it } from 'vitest'
import { resolveRuntimeWebConfig } from './web-config'

describe('resolveRuntimeWebConfig', () => {
  it('prefers Cloudflare Worker runtime values over build-time defaults', () => {
    expect(
      resolveRuntimeWebConfig({
        workerEnv: {
          PUBLIC_PRODUCT_NAME: 'HowiCC',
          PUBLIC_SITE_URL: 'https://howi.cc',
          PUBLIC_API_URL: 'https://api.howi.cc',
          API_SERVER_URL: 'https://api.howi.cc',
        },
        buildEnv: {
          PUBLIC_SITE_URL: 'http://localhost:4321',
          PUBLIC_API_URL: 'http://localhost:8787',
          API_SERVER_URL: 'http://localhost:8787',
        },
      }),
    ).toEqual({
      productName: 'HowiCC',
      siteUrl: 'https://howi.cc',
      publicApiUrl: 'https://api.howi.cc',
      apiServerUrl: 'https://api.howi.cc',
    })
  })

  it('falls back to build-time values when runtime bindings are absent', () => {
    expect(
      resolveRuntimeWebConfig({
        buildEnv: {
          PUBLIC_PRODUCT_NAME: 'HowiCC Preview',
          PUBLIC_SITE_URL: 'https://preview.howi.cc',
          PUBLIC_API_URL: 'https://preview-api.howi.cc',
        },
      }),
    ).toEqual({
      productName: 'HowiCC Preview',
      siteUrl: 'https://preview.howi.cc',
      publicApiUrl: 'https://preview-api.howi.cc',
      apiServerUrl: 'https://preview-api.howi.cc',
    })
  })

  it('uses localhost defaults only when neither runtime nor build values exist', () => {
    expect(resolveRuntimeWebConfig({})).toEqual({
      productName: 'HowiCC',
      siteUrl: 'http://localhost:4321',
      publicApiUrl: 'http://localhost:8787',
      apiServerUrl: 'http://localhost:8787',
    })
  })
})
