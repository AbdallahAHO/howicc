import { useEffect, useMemo, useState } from 'react'
import { Button } from '@howicc/ui-web/button'
import { Input } from '@howicc/ui-web/input'
import { Label } from '@howicc/ui-web/label'
import { Switch } from '@howicc/ui-web/switch'
import { Textarea } from '@howicc/ui-web/textarea'
import type {
  PublicProfileMineResponse,
  PublicProfileSettings,
} from '@howicc/contracts'

type Props = {
  apiUrl: string
  initial: PublicProfileMineResponse
  username: string
  siteUrl: string
}

const SECTION_META: Array<{
  key: keyof PublicProfileSettings
  label: string
  description: string
}> = [
  {
    key: 'showActivityHeatmap',
    label: 'Activity heatmap',
    description: 'Hours and weekdays you\'re most active.',
  },
  {
    key: 'showSessionTypes',
    label: 'Session types',
    description: 'Building, debugging, exploring — the mix.',
  },
  {
    key: 'showToolsLanguages',
    label: 'Tools & languages',
    description: 'What you reach for most.',
  },
  {
    key: 'showRepositories',
    label: 'Repositories',
    description: 'Public repos with at least one synced session.',
  },
  {
    key: 'showBadges',
    label: 'Badges',
    description: 'Auto-awarded tags like Builder and Night Owl.',
  },
  {
    key: 'showCost',
    label: 'Total cost',
    description: 'Running USD total. Hidden by default.',
  },
]

const sanitizeUrl = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export default function PublicProfileIsland({
  apiUrl,
  initial,
  username,
  siteUrl,
}: Props) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? '')
  const [settings, setSettings] = useState<PublicProfileSettings>(initial.settings)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'idle') {
      const timer = setTimeout(() => setStatus('idle'), 2200)
      return () => clearTimeout(timer)
    }
  }, [status])

  const profileUrl = useMemo(
    () => `${siteUrl.replace(/\/+$/, '')}/${username}`,
    [siteUrl, username],
  )

  const urlInvalid = websiteUrl.length > 0 && !sanitizeUrl(websiteUrl)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        enabled,
        bio: bio.trim().length > 0 ? bio.trim() : null,
        websiteUrl: websiteUrl.trim().length > 0 ? sanitizeUrl(websiteUrl) : null,
        settings,
      }
      const response = await fetch(
        `${apiUrl.replace(/\/+$/, '')}/profile/public-settings`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`)
      }
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="public-profile-enabled" className="text-sm font-medium">
            Make my profile public
          </Label>
          {enabled ? (
            <p className="text-muted-foreground text-sm text-pretty">
              Visit{' '}
              <a
                className="hover:text-foreground font-mono"
                href={profileUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {profileUrl.replace(/^https?:\/\//, '')}
              </a>{' '}
              to see what people see.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm text-pretty">
              Off for now. Flip the switch and it'll be reachable at the URL above.
            </p>
          )}
        </div>
        <Switch
          id="public-profile-enabled"
          checked={enabled}
          onCheckedChange={value => setEnabled(value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="public-profile-bio">Bio</Label>
        <Textarea
          id="public-profile-bio"
          value={bio}
          onChange={event => setBio(event.target.value)}
          maxLength={280}
          placeholder="One line about what you build."
          rows={3}
          disabled={!enabled}
        />
        <p className="text-muted-foreground text-right text-xs tabular-nums">
          {bio.length} / 280
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="public-profile-website">Website</Label>
        <Input
          id="public-profile-website"
          type="url"
          value={websiteUrl}
          onChange={event => setWebsiteUrl(event.target.value)}
          placeholder="https://..."
          disabled={!enabled}
          aria-invalid={urlInvalid}
        />
        {urlInvalid ? (
          <p className="text-destructive text-xs">Enter a valid http(s) URL.</p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-4" disabled={!enabled}>
        <legend className="text-muted-foreground text-sm font-medium">
          What to show on your profile
        </legend>
        <div className="flex flex-col gap-3">
          {SECTION_META.map(section => (
            <div
              key={section.key}
              className="border-border/60 flex items-start justify-between gap-4 rounded-lg border p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{section.label}</span>
                <span className="text-muted-foreground text-xs">
                  {section.description}
                </span>
              </div>
              <Switch
                checked={settings[section.key]}
                onCheckedChange={value =>
                  setSettings(prev => ({ ...prev, [section.key]: value }))
                }
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || urlInvalid}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {status === 'saved' ? (
          <span className="text-muted-foreground text-sm">Saved.</span>
        ) : null}
        {status === 'error' ? (
          <span className="text-destructive text-sm">
            {error ?? 'Could not save. Try again.'}
          </span>
        ) : null}
        {initial.profileViewCount > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {initial.profileViewCount.toLocaleString()} profile views
          </span>
        ) : null}
      </div>
    </div>
  )
}
