/**
 * Progressive-enhancement scrollspy for /s/:slug's phase spine.
 *
 * SSR renders the spine (desktop rail + mobile chip bar) with no active
 * state. On load this wire function attaches an IntersectionObserver to
 * every phase section, then toggles `data-active="true"` on the spine
 * link whose section is currently topmost in the reading band. Styling
 * is pure Tailwind `data-[active=true]:` modifiers — no JS touches
 * classNames, so if the script fails the page still renders correctly.
 *
 * The wire function is idempotent and safe to call multiple times.
 *
 * @example
 * ---
 * wirePhaseSpine()
 * ---
 */

const PHASE_LINK_ATTR = 'data-phase-link'
const PHASE_ACTIVE_ATTR = 'data-active'

const uniqueSections = (
  links: Array<HTMLElement>,
): Array<{ phase: string; element: HTMLElement }> => {
  const seen = new Set<string>()
  const out: Array<{ phase: string; element: HTMLElement }> = []

  for (const link of links) {
    const phase = link.getAttribute(PHASE_LINK_ATTR)
    if (!phase || seen.has(phase)) continue

    const section = document.getElementById(phase)
    if (!section) continue

    seen.add(phase)
    out.push({ phase, element: section })
  }

  return out
}

export const wirePhaseSpine = (): (() => void) | void => {
  if (typeof window === 'undefined') return
  if (typeof IntersectionObserver === 'undefined') return

  const links = Array.from(
    document.querySelectorAll<HTMLElement>(`[${PHASE_LINK_ATTR}]`),
  )
  if (links.length === 0) return

  const sections = uniqueSections(links)
  if (sections.length === 0) return

  const setActive = (phase: string) => {
    for (const link of links) {
      const target = link.getAttribute(PHASE_LINK_ATTR)
      link.setAttribute(PHASE_ACTIVE_ATTR, target === phase ? 'true' : 'false')
    }
  }

  // Default to the first phase so the rail is never blank before the
  // observer settles.
  setActive(sections[0]!.phase)

  const elementToPhase = new Map<Element, string>()
  for (const { phase, element } of sections) {
    elementToPhase.set(element, phase)
  }

  const intersecting = new Set<Element>()

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          intersecting.add(entry.target)
        } else {
          intersecting.delete(entry.target)
        }
      }

      if (intersecting.size === 0) return

      // Active = the topmost currently-intersecting section.
      let topmost: Element | null = null
      let topmostY = Number.POSITIVE_INFINITY
      for (const element of intersecting) {
        const { top } = element.getBoundingClientRect()
        if (top < topmostY) {
          topmost = element
          topmostY = top
        }
      }

      if (!topmost) return
      const phase = elementToPhase.get(topmost)
      if (phase) setActive(phase)
    },
    {
      // Trigger band at the top ~40% of the viewport — comfortably below
      // the sticky header and above the fold so the active state matches
      // what the reader is actually looking at.
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    },
  )

  for (const { element } of sections) {
    observer.observe(element)
  }

  return () => {
    observer.disconnect()
  }
}
