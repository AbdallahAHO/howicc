export const buildOpenRouterCatalogPreload = () => `
const originalFetch = globalThis.fetch.bind(globalThis)
const openRouterUrl = 'https://openrouter.ai/api/v1/models'

globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  if (url === openRouterUrl) {
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'anthropic/claude-sonnet-4.6',
            canonical_slug: 'anthropic/claude-4.6-sonnet-20260217',
            name: 'Anthropic: Claude Sonnet 4.6',
            pricing: {
              prompt: '0.000003',
              completion: '0.000015',
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }

  return originalFetch(input, init)
}
`
