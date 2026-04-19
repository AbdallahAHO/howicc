/**
 * Keeps `<details data-responsive-details>` elements force-open at the
 * given breakpoint and returns user control below it.
 *
 * Use case: on /s/:slug the session meta sidebar is a native <details>
 * so mobile users get a compact, collapsible sidebar, but on md+ the
 * summary is visually hidden and the content should always be visible.
 * This helper enforces the open state on md+ and restores the user's
 * previous choice when the viewport shrinks again.
 *
 * Idempotent; safe on SSR.
 *
 * @example
 * <details data-responsive-details data-breakpoint="768" open>…</details>
 * ---
 * wireResponsiveDetails()
 */

const ATTR = 'data-responsive-details'
const BREAKPOINT_ATTR = 'data-breakpoint'
const USER_STATE_ATTR = 'data-user-open'

export const wireResponsiveDetails = (): (() => void) | void => {
  if (typeof window === 'undefined') return
  if (typeof document === 'undefined') return

  const elements = Array.from(
    document.querySelectorAll<HTMLDetailsElement>(`details[${ATTR}]`),
  )
  if (elements.length === 0) return

  const apply = () => {
    const width = window.innerWidth

    for (const element of elements) {
      const breakpoint = Number.parseInt(
        element.getAttribute(BREAKPOINT_ATTR) ?? '768',
        10,
      )
      const threshold = Number.isFinite(breakpoint) ? breakpoint : 768

      if (width >= threshold) {
        if (!element.hasAttribute(USER_STATE_ATTR)) {
          element.setAttribute(USER_STATE_ATTR, element.open ? 'true' : 'false')
        }
        element.open = true
      } else {
        const preferred = element.getAttribute(USER_STATE_ATTR)
        if (preferred !== null) {
          element.open = preferred === 'true'
        }
      }
    }
  }

  const handleUserToggle = (event: Event) => {
    const target = event.target as HTMLDetailsElement | null
    if (!target || window.innerWidth >= Number.parseInt(target.getAttribute(BREAKPOINT_ATTR) ?? '768', 10)) {
      return
    }
    target.setAttribute(USER_STATE_ATTR, target.open ? 'true' : 'false')
  }

  for (const element of elements) {
    element.addEventListener('toggle', handleUserToggle)
  }

  apply()
  window.addEventListener('resize', apply, { passive: true })

  return () => {
    window.removeEventListener('resize', apply)
    for (const element of elements) {
      element.removeEventListener('toggle', handleUserToggle)
    }
  }
}
