/**
 * Font loader for the OG image renderer.
 *
 * Satori needs actual font bytes — it can't resolve system fonts. We lazily
 * fetch Inter Regular + SemiBold from a public CDN on the first OG render
 * per worker instance and cache the bytes in module scope. Cold start cost
 * is ~40-60KB per weight, one time per worker, and warms stay instant.
 *
 * If the fetch fails we fall back to undefined — the caller will serve the
 * static fallback PNG, so a font-CDN outage never 500s the OG endpoint.
 */

type LoadedFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 600
  style: 'normal'
}

let cachedFonts: LoadedFont[] | null = null

const FONT_SOURCES: Array<Omit<LoadedFont, 'data'> & { url: string }> = [
  {
    name: 'Inter',
    weight: 400,
    style: 'normal',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
  },
  {
    name: 'Inter',
    weight: 600,
    style: 'normal',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf',
  },
]

export const loadOgFonts = async (): Promise<LoadedFont[] | null> => {
  if (cachedFonts) return cachedFonts

  try {
    const results = await Promise.all(
      FONT_SOURCES.map(async source => {
        const response = await fetch(source.url)
        if (!response.ok) {
          throw new Error(`Font fetch failed: ${source.url} (${response.status})`)
        }
        const data = await response.arrayBuffer()
        return {
          name: source.name,
          weight: source.weight,
          style: source.style,
          data,
        }
      }),
    )
    cachedFonts = results
    return results
  } catch {
    return null
  }
}
