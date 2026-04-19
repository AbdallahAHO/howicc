import { ImageResponse } from 'workers-og'
import { loadOgFonts } from './fonts'

export type ProfileCardInput = {
  username: string
  displayName: string
  avatarUrl?: string
  sessionCount: number
  totalDurationMs: number
  currentStreak: number
}

const WIDTH = 1200
const HEIGHT = 630

const BG = '#0a0a0a'
const FG = '#fafafa'
const MUTED = '#a1a1aa'
const ACCENT = '#8b5cf6'
const BORDER = '#27272a'

const formatHours = (durationMs: number): string => {
  const hours = durationMs / (1000 * 60 * 60)
  if (hours >= 100) return `${Math.round(hours)}h`
  if (hours >= 10) return `${hours.toFixed(0)}h`
  return `${hours.toFixed(1)}h`
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildCardHtml = (input: ProfileCardInput): string => {
  const sessionLabel = input.sessionCount === 1 ? 'session' : 'sessions'
  const streakLabel = input.currentStreak === 1 ? 'day streak' : 'day streak'

  const avatarMarkup = input.avatarUrl
    ? `<img src="${escapeHtml(input.avatarUrl)}" width="128" height="128" style="width:128px;height:128px;border-radius:9999px;border:3px solid ${BORDER};" />`
    : `<div style="display:flex;align-items:center;justify-content:center;width:128px;height:128px;border-radius:9999px;background:${BORDER};color:${FG};font-size:56px;font-weight:600;">${escapeHtml(
        input.displayName.slice(0, 1).toUpperCase() || 'H',
      )}</div>`

  return `
    <div style="display:flex;flex-direction:column;width:${WIDTH}px;height:${HEIGHT}px;padding:72px;background:${BG};color:${FG};font-family:Inter, sans-serif;position:relative;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:${ACCENT};color:${BG};font-size:22px;font-weight:600;letter-spacing:-0.02em;">H</div>
        <div style="display:flex;font-size:18px;color:${MUTED};letter-spacing:-0.01em;">howi.cc</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto;">
        <div style="display:flex;align-items:center;gap:32px;">
          ${avatarMarkup}
          <div style="display:flex;flex-direction:column;">
            <div style="display:flex;font-size:64px;font-weight:600;letter-spacing:-0.03em;line-height:1.05;">${escapeHtml(input.displayName)}</div>
            <div style="display:flex;font-size:28px;color:${MUTED};margin-top:8px;letter-spacing:-0.01em;">@${escapeHtml(input.username)}</div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:28px;margin-top:56px;">
        <div style="display:flex;flex-direction:column;padding:22px 28px;background:#141414;border:1px solid ${BORDER};border-radius:16px;min-width:220px;">
          <div style="display:flex;font-size:48px;font-weight:600;letter-spacing:-0.02em;line-height:1;">${input.sessionCount.toLocaleString()}</div>
          <div style="display:flex;font-size:16px;color:${MUTED};margin-top:8px;">${escapeHtml(sessionLabel)}</div>
        </div>
        <div style="display:flex;flex-direction:column;padding:22px 28px;background:#141414;border:1px solid ${BORDER};border-radius:16px;min-width:220px;">
          <div style="display:flex;font-size:48px;font-weight:600;letter-spacing:-0.02em;line-height:1;">${formatHours(input.totalDurationMs)}</div>
          <div style="display:flex;font-size:16px;color:${MUTED};margin-top:8px;">total time</div>
        </div>
        <div style="display:flex;flex-direction:column;padding:22px 28px;background:#141414;border:1px solid ${BORDER};border-radius:16px;min-width:220px;">
          <div style="display:flex;font-size:48px;font-weight:600;letter-spacing:-0.02em;line-height:1;">${input.currentStreak}</div>
          <div style="display:flex;font-size:16px;color:${MUTED};margin-top:8px;">${escapeHtml(streakLabel)}</div>
        </div>
      </div>
    </div>
  `
}

/**
 * Renders the 1200×630 PNG profile card and returns the bytes.
 *
 * Returns null when font loading fails or Satori throws on the layout —
 * callers should serve the static fallback PNG in that case so social
 * crawlers never see a 500.
 */
export const renderProfileCardPng = async (
  input: ProfileCardInput,
): Promise<Uint8Array | null> => {
  try {
    const fonts = await loadOgFonts()
    if (!fonts) return null

    const response = new ImageResponse(buildCardHtml(input), {
      width: WIDTH,
      height: HEIGHT,
      format: 'png',
      fonts: fonts.map(f => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    })

    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes
  } catch {
    return null
  }
}

export const OG_IMAGE_WIDTH = WIDTH
export const OG_IMAGE_HEIGHT = HEIGHT
