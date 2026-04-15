# Developer Brutalism — HowiCC Web PRD

> **⚠ Status: Archived as an alternative direction.**
>
> The canonical design direction for HowiCC web is **[The Archive](20-design-md-the-archive.md)** —
> a warm, editorial, Claude-aesthetic alternative. This doc (Developer Brutalism)
> remains as a valid second option and as inspiration for:
>
> - The CLI's terminal output styling (where brutalism genuinely belongs)
> - A possible "focus mode" / "terminal mode" toggle in the future
> - The conceptual rigor around information density and anti-decoration
>
> When implementing the web app, follow doc 20. This doc's structural principles
> (component specs, screen layouts, build phases, accessibility) remain useful
> and are preserved below. Only the visual language (pure black, UPPERCASE,
> 0-radius, mono-only) has been superseded by the warmer alternative.
>
> **Why the change:** HowiCC's core value proposition is preserving sessions as
> durable, readable artifacts. The conversation detail page is fundamentally a
> reading experience. Reading deserves warm paper, serif headings, and generous
> line-height — not a dark terminal. See doc 20 "The Archive vs Binary Architect"
> for the full comparison.

A comprehensive product and design spec for the HowiCC web experience. Translates
doc 17 wireframes and doc 18 data contracts into a detailed brutalist design system
with complete screen specifications.

**Companion docs:**
- [20-design-md-the-archive.md](20-design-md-the-archive.md) — **canonical design direction**
- [17-web-app-pages-and-screens.md](17-web-app-pages-and-screens.md) — page inventory
- [18-data-and-api-per-page.md](18-data-and-api-per-page.md) — data contracts
- [15-jtbd-ux-flows-and-user-journey.md](15-jtbd-ux-flows-and-user-journey.md) — user journeys

---

## Table of Contents

1. Product Overview
2. Design Philosophy
3. Brand Identity
4. Design System
5. Component Library
6. Layout System
7. Screen Specifications
8. Interaction Patterns
9. Motion and Animation
10. Content and Voice
11. Accessibility
12. Implementation Guide
13. Build Phases
14. Success Metrics
15. Open Questions

---

## 1. Product Overview

### The Pitch

HowiCC captures your AI-assisted coding sessions and transforms them into shareable,
structured artifacts — not chat logs. The terminal captures what happened. HowiCC
preserves why, how, and what you decided along the way.

### The Problem

Developers using Claude Code, Cursor, and similar tools generate thousands of
hours of AI-assisted work. This work vanishes:

- **Locally:** Claude Code purges old sessions; context is lost.
- **Socially:** When a developer solves an interesting problem with AI, there's
  no good way to share it. Screenshots flatten tool calls. Copy-pasted markdown
  loses structure. Twitter threads can't hold a 7-hour session.
- **Organizationally:** Teams can't see how they collectively use AI on a repo.
  No shared learning, no pattern recognition.
- **Personally:** Developers can't look back at how they solved something months
  ago. No searchable history. No personal analytics.

### The Solution

A CLI + web platform that:

1. **Captures** sessions locally via CLI with zero friction.
2. **Parses** them into a structured canonical form (events, tools, artifacts,
   subagents) — not flat text.
3. **Syncs** to the cloud with privacy-first defaults (private by default).
4. **Displays** sessions as readable, navigable documents with phase structure,
   tool breakdowns, and expandable activity groups.
5. **Shares** sessions as shareable public links or private team dashboards.
6. **Analyzes** patterns across sessions — tool usage, cost, languages, streaks.

### Target Users

```
  PRIMARY
  ───────
  Backend developers       Work in terminal daily. Want dense information.
                           CLI-native workflows. Monospace-first mental model.

  SECONDARY
  ─────────
  CLI power users          Tmux, vim, bash veterans. Dislike visual noise.
  Open-source maintainers  Want to show repo contributors how AI is used.
  Engineering leads        Want team-level AI usage visibility.

  TERTIARY
  ────────
  Curious developers       Discover HowiCC via shared profile links.
                           First impression is a public profile or session.
```

### Primary Device

**Desktop-first.** The authenticated experience assumes a 1440×900 or larger
screen. Mobile is supported for shared link consumption (public conversations,
public profiles) but never for creation or team administration.

### Differentiation

| HowiCC | Alternatives |
|--------|--------------|
| Brutalist, terminal-native aesthetic | "AI dashboard" template with glowing gradients |
| Structured session parsing (events + artifacts + subagents) | Flat markdown export |
| GitHub-verified team access | Public or nothing |
| Session phase detection (narrative spine) | Flat chat-log viewers |
| Digest-based profile aggregation | Raw session counts |
| Mobile-first for public pages | Desktop-only or non-responsive |

---

## 2. Design Philosophy

### Why Brutalism

The product serves developers who live in the terminal. Every other AI tool
looks the same — glassmorphic cards, subtle gradients, Inter typography, rounded
corners, soft shadows. That aesthetic signals "we added AI to our SaaS." HowiCC
signals something different: **this is a tool built by and for people who like
the command line.**

Brutalism earns trust with the target audience by rejecting visual decoration
in favor of information density. Every pixel serves a function. No elements
exist to look pretty — they exist because they communicate something.

### Core Principles

**1. Information density over whitespace theater.**
Every screen packs meaningful data. Whitespace exists to separate ideas, not
to look premium. A developer's brain can scan dense tables faster than decorated
cards.

**2. Monospace everything.**
JetBrains Mono is the only typeface. It makes everything feel like terminal
output — code, commands, numbers, headings, buttons. Alignment becomes trivial
because every character is the same width.

**3. 1 pixel borders, 0 radius, 0 shadows.**
Sharp rectangles. Clean lines. If an element needs emphasis, change its color
or weight, not its border radius. No shadows — brutalism is flat.

**4. Color as meaning, not decoration.**
The palette is strictly functional:
- Black = background
- White = text
- Green = interactive, success, active
- Red = error, destructive
- Gray = muted, secondary

Every color has a job. No gradients. No "accent color" that means nothing.

**5. Text over icons.**
When there's a choice, use text labels. Icons require memorization and often
fail across cultures. `[REVOKE]` is clearer than a trash can icon. Exception:
standard system icons (arrows, checkmarks) are allowed because they're universal.

**6. ASCII when it fits.**
Tables, dividers, tree structures, bar charts, and decorative elements use
ASCII character blocks when possible. This reinforces the terminal aesthetic
and keeps rendering cheap.

**7. No animation unless it communicates state.**
Cursor blink = input ready. Progress bar fill = loading. Everything else is
still. No hover fades, no scroll parallax, no entry animations.

**8. Terminal metaphors where natural.**
- Status bars use `[status]` brackets
- Commands look like `$ howicc sync`
- Errors prefix with `ERR:`
- Success prefixes with `OK`
- Loading uses `[████░░░░] 50%`

Not forced — only where it makes the interface clearer.

### What We Avoid (Anti-Patterns)

```
  ✗  Rounded corners                 ✗  Gradient text
  ✗  Drop shadows                    ✗  Glassmorphism
  ✗  Skeuomorphic depth              ✗  3D transforms
  ✗  Hover animations                ✗  Pastel accents
  ✗  Inter, Geist, system fonts      ✗  Emoji in UI chrome
  ✗  Gradient backgrounds            ✗  Glowing focus rings
  ✗  "AI sparkle" decoration         ✗  Colorful illustrations
  ✗  Tooltips with arrow pointers    ✗  Card shadow elevation
  ✗  Page background blur            ✗  Mouse-following effects
```

These are the fingerprints of AI-generated design. Avoiding them is the design
system's main job.

### Inspirations (With Rationale)

```
  Linear command menu     Keyboard-first, dense, monospace results.
                          We borrow the command palette pattern and the idea
                          that power users navigate with keys, not clicks.

  Hacker News             No styling. Text is the interface. Content has
                          absolute priority. We borrow the information-first
                          layout and the resistance to redesign trends.

  macOS Terminal          The actual reference for what "terminal" looks like.
                          We don't literally imitate it, but every component
                          should feel like it could exist inside one.

  Claude Code CLI output  Our own CLI produces structured text output with
                          tables, tree structures, and status indicators.
                          The web app should feel continuous with this.

  Low-level tool docs     Man pages, info pages, systemd docs. Terse, dense,
                          technically complete. We aim for that density.

  GitHub contribution     The heatmap component is the one widget we inherit
  graph                   directly. It's already monospace-adjacent and it's
                          the industry standard for "time-based activity".
```

---

## 3. Brand Identity

### Name

**HowiCC** — rhymes with "how is it." Pronounced "how-eye-see-see." A compression
of "how Claude codes." Stylized lowercase in body text (`howicc`), stylized
case-preserved in logos and headers (`HowiCC`).

### Tagline

```
  Primary:    "The shell has a memory now."
  Alternate:  "Your AI coding sessions, durable."
  Alternate:  "Save. Read. Share. Repeat."
```

### Voice

**Terse, direct, developer-literate.** Writes like good CLI help text.

```
  ✓  "Syncs your Claude Code sessions to a URL."
  ✗  "HowiCC empowers developers to effortlessly share..."

  ✓  "47 sessions. 136 hours. 3 contributors."
  ✗  "A vibrant community of 3 amazing contributors..."

  ✓  "No public sessions. Run `howicc sync` to fix that."
  ✗  "Looks like there's nothing here yet! Why not..."
```

Never:
- Uses marketing adjectives ("amazing," "seamless," "revolutionary")
- Apologizes for technical concepts
- Exclaims ("!" is rare)
- Uses emoji as prose punctuation

Always:
- Assumes technical literacy
- Shows numbers and let them speak
- Uses code fonts for commands, field names, status

### Logo

```
  ASCII primary:   [ howicc ]
  Text logo:       HowiCC
  Favicon:         Solid green square with "h" in black, 16×16
  Social avatar:   Solid black square with "howicc" in green, 512×512
```

No animated logo. No gradient logo. No logo with tagline.

### Reserved Wordmarks

```
  Product:   HowiCC
  CLI:       howicc (lowercase, monospace, always)
  Domain:    howi.cc (not howicc.com, not howicc.io)
  Handle:    @howicc (social)
```

---

## 4. Design System

### Color Palette

#### Base Tokens

```css
/* Pure values */
--pure-black:    #000000;
--pure-white:    #FFFFFF;
--terminal-green: #00FF41;
--alert-red:      #FF003C;

/* Grays (used for hierarchy) */
--gray-50:  #F3F3F3;  /* Primary text */
--gray-200: #CCCCCC;  /* Bright muted */
--gray-400: #888888;  /* Standard muted / borders on dark */
--gray-600: #555555;  /* Dim text */
--gray-800: #333333;  /* Subtle borders */
--gray-900: #111111;  /* Secondary surface */
```

#### Semantic Tokens

```css
/* Surfaces */
--surface-base:     var(--pure-black);     /* Page background */
--surface-raised:   var(--gray-900);       /* Cards, code blocks, inputs */
--surface-overlay:  var(--pure-black);     /* Modals, dropdowns (with border) */

/* Text */
--text-primary:     var(--gray-50);        /* Body */
--text-secondary:   var(--gray-400);       /* Meta, timestamps */
--text-muted:       var(--gray-600);       /* Dim, disabled */
--text-inverse:     var(--pure-black);     /* On green buttons */
--text-accent:      var(--terminal-green); /* Active, interactive */
--text-error:       var(--alert-red);      /* Errors only */

/* Borders */
--border-subtle:    var(--gray-800);       /* Default 1px borders */
--border-default:   var(--gray-400);       /* Prominent borders */
--border-active:    var(--terminal-green); /* Focus, active */
--border-error:     var(--alert-red);      /* Validation errors */

/* Interactive */
--interactive:         var(--terminal-green);
--interactive-hover:   #3DFF6B;  /* 15% brighter */
--interactive-active:  #00CC33;  /* 15% dimmer */

/* Status */
--status-success: var(--terminal-green);
--status-warning: #FFB800;
--status-error:   var(--alert-red);
--status-info:    var(--gray-400);
```

#### Usage Rules

```
  COLOR              USE                      NEVER
  ─────              ───                      ─────
  Terminal green     Links, active states,    Large fills
                     selected items, counts   Text blocks over 12 chars
                     that matter, primary     Gradient combinations
                     buttons, focus rings

  Alert red          Errors, destructive      Buttons (only in confirmations)
                     actions, warnings        Decoration

  Grays              Hierarchy, borders,      Shadows
                     muted text, secondary    Soft fills

  Pure black         Page bg, button text     Body text
                     on green

  White-gray         Body text, headings      Backgrounds
```

### Typography

#### Font Family

```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', monospace;
```

**JetBrains Mono is the only font.** No fallback to Inter. No sans-serif for
headings. No proportional fonts anywhere. If JetBrains Mono fails to load,
fall back to the system monospace (which still preserves the aesthetic).

#### Type Scale

```
NAME        SIZE   LINE   WEIGHT   USE
────        ────   ────   ──────   ───
display     32px   40px   700      Landing hero, profile hero
title-1     24px   32px   700      Page titles (/home, /insights)
title-2     20px   28px   600      Section headers
title-3     16px   24px   600      Subsection, card titles
body        14px   22px   400      Default paragraph, list items
body-bold   14px   22px   600      Emphasized body
small       12px   18px   400      Metadata, captions, timestamps
tiny        11px   16px   400      Labels, status chips
code        13px   20px   400      Code blocks, inline code
```

#### Type Rules

1. **Headings are uppercase only for section labels** (`RECENT SESSIONS`,
   `TOP TOOLS`), never for page titles or content.
2. **Numbers use `font-variant-numeric: tabular-nums`** for alignment.
3. **Inline code and prose use the same font** — no visual distinction needed.
4. **Buttons use uppercase tiny size with 1px letter-spacing** for that terminal
   command feel (`[ CREATE TOKEN ]`).
5. **No italic.** JetBrains Mono has italic but it's not used. Emphasis comes
   from color or weight.

### Spacing

#### Base Unit: 4px

```css
--space-0:   0px;
--space-1:   4px;   /* Tight padding */
--space-2:   8px;   /* Default tight gap */
--space-3:   12px;
--space-4:   16px;  /* Default gap */
--space-5:   20px;
--space-6:   24px;  /* Section gap */
--space-8:   32px;  /* Large section gap */
--space-10:  40px;
--space-12:  48px;  /* Page section break */
--space-16:  64px;  /* Hero padding */
--space-20:  80px;  /* Landing hero */
```

#### Spacing Rules

1. **Default element padding: 16px (4).** Most cards, panels, and buttons use this.
2. **Section gap: 24px (6).** Between major sections on a page.
3. **Page top padding: 48px (12).** From nav bar to first content.
4. **Card internal gap: 12px (3).** Between fields inside a card.
5. **Never use non-scale values.** No 15px, no 22px. If a designer wants a
   half-step, they add it to the scale first.

### Borders

**Every container has a 1px border.** This is the signature of the system.

```css
--border-width: 1px;
--border-style: solid;

/* Usage */
border: 1px solid var(--border-subtle);
```

**Border rules:**

1. **1px is non-negotiable.** No 2px, no 0.5px, no dashed, no dotted.
2. **Radius is always 0.** Sharp corners everywhere. No exceptions.
3. **Border color by elevation:**
   - Page-level containers: `--border-subtle` (#333)
   - Interactive containers: `--border-default` (#888)
   - Focused/active: `--border-active` (green)
   - Error: `--border-error` (red)
4. **Nested containers share borders.** When two cards sit next to each other,
   their shared edge is one line, not two.

### Shadows

**There are no shadows.** Not subtle, not drop, not inset. Elevation is
communicated by:
- Border presence (container has a border, content doesn't)
- Background color change (content is `--surface-base`, card is `--surface-raised`)
- Z-index layering (modals over content — with a border, no shadow)

### Grid System

```
  12-column grid
  ──────────────
  Max width:     1440px
  Gutter:        16px
  Margin:        32px (desktop), 16px (tablet), 16px (mobile)

  Breakpoints:
  ────────────
  mobile         < 768
  tablet         768 - 1023
  desktop        1024 - 1439
  wide           ≥ 1440
```

### Cursor

```
  Default:     default
  Interactive: pointer
  Text input:  text
  Blinking:    for loading states (animated pseudo-element, not actual cursor)
```

### Selection

```css
::selection {
  background: var(--terminal-green);
  color: var(--pure-black);
}
```

The whole page selection is green-on-black. Matches the terminal metaphor.

---

## 5. Component Library

### Buttons

#### Variants

```
PRIMARY
┌─────────────────────┐
│   [ CREATE TOKEN ]  │   Green border, black bg, green text
└─────────────────────┘   Hover: Green fill, black text

SECONDARY
┌─────────────────────┐
│   [ CANCEL ]        │   Gray border, black bg, white text
└─────────────────────┘   Hover: Gray fill, black text

GHOST
  [ VIEW ALL →]            No border, gray text
                           Hover: green text

DESTRUCTIVE
┌─────────────────────┐
│   [ DELETE ]        │   Red border, black bg, red text
└─────────────────────┘   Hover: Red fill, white text

DISABLED
┌─────────────────────┐
│   [ REVOKED ]       │   Dimmer gray border, muted text
└─────────────────────┘   No hover. cursor: not-allowed
```

#### Spec

```
PROP             VALUE
────             ─────
Height           32px (default) / 40px (large) / 24px (small)
Padding          16px horizontal / 0 vertical
Font             tiny (11px) uppercase, 1px letter-spacing, 600 weight
Border           1px solid (variant-specific color)
Background       transparent by default, fills on hover
Text              uppercase, variant-specific color
Transition       none on hover (instant swap) — brutalism rejects easing
Focus            Outline 2px solid green (keyboard only, via :focus-visible)
Disabled         opacity: 0.5, no hover state, no click handler
Loading          Text becomes `[████░░░░]`, not a spinner
```

#### Syntax

```tsx
<Button variant="primary">CREATE TOKEN</Button>
<Button variant="secondary">CANCEL</Button>
<Button variant="destructive">DELETE</Button>
<Button variant="ghost">VIEW ALL →</Button>
<Button variant="primary" loading>SAVING</Button>
<Button variant="primary" disabled>REVOKED</Button>
```

**Button labels always ALL CAPS.** Arrow suffixes allowed (`→`). Bracket wrapping
is the default visual (`[ LABEL ]` is how the button reads when you look at it).

### Inputs

#### Text Input

```
┌───────────────────────────────────────┐
│ > search sessions...                  │
└───────────────────────────────────────┘
```

```
PROP              VALUE
────              ─────
Height            36px
Padding           0 16px
Border            1px solid var(--border-subtle)
Background        var(--surface-raised)
Color             var(--text-primary)
Placeholder       var(--text-muted)
Focus             border becomes var(--border-active), no outline
Prefix            `> ` (green, optional, for search fields)
Error             border becomes var(--border-error), help text in red below
```

#### Select / Dropdown

```
┌───────────────────────────────────────┐
│ All repos                         [v] │
└───────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────┐
│ ● All repos                           │ ← selected (green dot)
│ ○ axetay/really-app                   │
│ ○ personal/howicc                     │
│ ○ axetay/really-data                  │
└───────────────────────────────────────┘
```

Selection uses filled/open circles, not checkboxes. Sharp borders. Opens below
the trigger, never with animation, never floating above.

#### Radio

```
● Private      ← selected
○ Members
○ Public
```

Filled green circle when selected. 12px diameter. Label to the right.

#### Checkbox

```
[x] Make my profile public
[ ] Show activity heatmap
[x] Show cost estimate
```

Uses literal `[x]` and `[ ]` characters in monospace, not rendered SVG.
Text label to the right. Toggle via click on the whole row.

### Cards

#### Default Card

```
┌──────────────────────────────────────┐
│ TITLE LABEL                          │
│                                      │
│ Content goes here. No padding at the │
│ top or bottom beyond what the border │
│ provides.                            │
│                                      │
└──────────────────────────────────────┘
```

```
PROP              VALUE
────              ─────
Border            1px solid var(--border-subtle)
Background        var(--surface-base) by default
Padding           16px
Header            Uppercase tiny label, separated from content by 12px
Radius            0
```

#### Interactive Card (Session Row)

```
┌──────────────────────────────────────┐
│ ● Add user profile system            │
│   howicc · building                  │
│   268 msgs · 7.6h · $2.14            │
│   [private]                 2h ago   │
└──────────────────────────────────────┘
```

On hover: left border becomes green, background becomes `--surface-raised`.
No transition — instant swap.

#### Card Grid

Cards in a grid share borders. Adjacent cards have no gap — their outer borders
touch, creating a continuous line.

```
┌──────────────┬──────────────┬──────────────┐
│  Card 1      │  Card 2      │  Card 3      │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
```

### Tables

```
TITLE           REPO          TYPE      DUR    COST   VIS
─────           ────          ────      ───    ────   ───
Add user...     howicc        build     7.6h   $2.14  prv
Fix auth...     really-app    debug     1.2h   $0.45  unl
...
```

```
PROP               VALUE
────               ─────
Header             Uppercase tiny, muted color, no background
Separator          1px bottom border under header row (subtle)
Row height         32px
Row padding        8px vertical, 16px horizontal
Hover row          Background becomes var(--surface-raised)
Column alignment   Left for text, right for numbers
Dividers           Row separators are 1px solid var(--border-subtle)
```

Tables are default-sortable. Sortable columns show `↑` or `↓` when active.

### Badges / Status Chips

```
[private]    [unlisted]    [public]    [archived]
```

```
PROP              VALUE
────              ─────
Height            20px
Padding           2px 8px
Font              tiny (11px)
Border            1px solid (variant-specific)
Background        transparent
Text              lowercase (unusual for this system — brackets handle emphasis)
```

**Variants:**
- `[private]` — gray border, gray text
- `[unlisted]` — gray border, white text
- `[public]` — green border, green text
- `[archived]` — dim gray border, muted text

### Nav Bar

```
┌──────────────────────────────────────────────────────────────┐
│ HowiCC  Home  Sessions  Insights             abdallah  [▼]  │
└──────────────────────────────────────────────────────────────┘
```

```
PROP              VALUE
────              ─────
Height            48px
Background        var(--surface-base)
Border            1px bottom border
Padding           0 32px
Logo              left-aligned, display-weight "HowiCC"
Nav items         Plain text, 16px gap, active item has green `>` prefix
Avatar            Initials in a 28px square on the right
```

Active nav item:
```
  Home   > Sessions   Insights
```
Green `>` prefix, no underline, no background change.

### Avatar

```
┌────┐      ┌────┐      ┌──────┐
│ AO │      │ SK │      │ avb  │
│  ● │      │    │      │      │
└────┘      └────┘      └──────┘
Small       Default    ASCII portrait (public profile hero)
```

```
PROP              VALUE
────              ─────
Default           28px square, initials in green, border 1px
Large             64px square, initials 24px, border 1px
Hero              128px square, with optional `●` live dot
ASCII (hero)      Pre-rendered ASCII art from GitHub avatar, 12 lines tall
Corner radius     0 (everywhere)
```

Optional live dot (`●` in green) means "has synced a session in the last 24h".

### Progress Bar

```
  [████░░░░░░] 40%
```

Rendered as monospace block characters, not a divs-and-fills DOM structure.
Updates by replacing the string. No easing.

### Loading

```
  Fetching profile...  _
                        ↑ blinking underscore cursor
```

Loading state for page transitions and async fetches. Blinking cursor is the
only animation allowed (via CSS `animation: blink 1s step-end infinite`).

Alternatives:
- `[████░░░░░░] 40%` — for measurable progress (upload, download)
- `Loading._`, `Loading.._`, `Loading..._` — for indeterminate waits

### Tabs

```
  [ ACCOUNT ] [ TOKENS ]   [ PROFILE ]
    ────────
```

Active tab has a 2px bottom border in green. Inactive tabs are plain text with
no border. No background. No icons. No animation on switch — tab content swaps
instantly.

### Modals

```
                    ┌──────────────────────────────┐
                    │ CONFIRM DELETION             │
                    │                              │
                    │ This will permanently delete │
                    │ your account and all synced  │
                    │ sessions.                    │
                    │                              │
                    │ Type DELETE to confirm:      │
                    │ ┌──────────────────────┐     │
                    │ │                      │     │
                    │ └──────────────────────┘     │
                    │                              │
                    │  [ CANCEL ]  [ DELETE ]      │
                    └──────────────────────────────┘
```

```
PROP              VALUE
────              ─────
Backdrop          Solid black at 90% opacity (not blurred)
Position          Centered, max-width 480px
Border            1px solid var(--border-default)
Background        var(--surface-base)
Padding           24px
Close             ESC key closes; no X button (rely on action buttons)
Focus trap        Tab cycles within modal only
```

**No animations on open/close.** Modal appears and disappears instantly.

### Toasts

```
┌─────────────────────────────────────┐
│ OK  Token copied to clipboard.      │
└─────────────────────────────────────┘
```

```
PROP              VALUE
────              ─────
Position          Bottom-right, 16px margin
Width             Max 360px
Border            1px solid (green for success, red for error)
Duration          4 seconds, dismissable
Prefix            `OK`, `ERR:`, `WARN:` in appropriate color
```

Stack vertically. No slide-in animation — appears and disappears.

### Separators

```
  ─────────────────────────────────────────
```

Full-width 1px horizontal line. `var(--border-subtle)` color. Margin 24px
vertical. Used between major sections.

For section breaks with labels:

```
  ─── RECENT ─────────────────────────────
```

### Tooltips

```
  axetay/really-app
  ┌─────────────────────┐
  │ 47 sessions · 136h  │
  └─────────────────────┘
```

```
PROP              VALUE
────              ─────
Background        var(--surface-base) with 1px border
Padding           8px 12px
Font              small (12px)
Position          Above the element (prefer) or below
Arrow             None — no arrow pointer. Brutalism doesn't do arrows.
Delay             300ms before showing
```

### Empty States

```
┌──────────────────────────────────────┐
│                                      │
│  No sessions synced yet.             │
│                                      │
│  $ npm install -g @howicc/cli        │
│  $ howicc login                      │
│  $ howicc sync                       │
│                                      │
│  [ CLI DOCS → ]                      │
│                                      │
└──────────────────────────────────────┘
```

Empty states are literal and instructional. No illustrations. No "Oops!" copy.
No emoji. They tell the user what to run or what to do next.

---

## 6. Layout System

### Container Widths

```
NAME              WIDTH      USE
────              ─────      ───
Narrow            640px      Forms, settings, text-heavy content
Default           960px      Standard content pages
Wide              1200px     Dashboards, tables
Full              1440px     Complex dashboards, grid layouts
Edge-to-edge      100%       Navigation bar, footer, landing hero
```

Container has 32px horizontal padding on desktop, 16px on mobile.

### Page Structure

```
┌────────────────────────────────────────────┐
│  NAV BAR (48px, 1px bottom border)         │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ PAGE CONTENT                         │  │
│  │ (container width, 48px top padding)  │  │
│  │                                      │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  FOOTER (minimal, 1px top border, small)   │
└────────────────────────────────────────────┘
```

### Multi-Column Layouts

```
Two-column (split):
┌──────────────────────────┬──────────────┐
│ MAIN (65%)               │ SIDE (35%)   │
│                          │              │
│                          │              │
└──────────────────────────┴──────────────┘

Three-column (conversation detail):
┌────────┬─────────────────────┬──────────┐
│ SPINE  │ MAIN (50ch max)     │ CONTEXT  │
│ 200px  │                     │ 250px    │
│        │                     │          │
└────────┴─────────────────────┴──────────┘

Grid (insights):
┌───────────┬───────────┬───────────┐
│           │           │           │
├───────────┴───────────┴───────────┤
│       full-width row              │
├───────────┬─────────────────────┬─┤
│           │                     │ │
└───────────┴─────────────────────┴─┘
```

Columns share borders where possible. No gutters — the borders are the gutters.

---

## 7. Screen Specifications

For each screen below: purpose, layout, data binding (references doc 18),
key elements, states, interactions, and responsive behavior.

### Screen 1: Landing (`/`)

#### Purpose

First impression for non-authenticated visitors. Explain the product, demonstrate
it with a real embedded session, drive sign-up.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HowiCC                                         [ SIGN IN ]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    display-size headline: "The shell has a memory now."     │
│                                                              │
│    body text: "Your AI coding sessions as structured,       │
│    shareable artifacts. Not a chat log."                    │
│                                                              │
│    [ SIGN IN WITH GITHUB ]    [ HOW IT WORKS ]              │
│                                                              │
│    ────────────────────────────────────────────────────     │
│                                                              │
│    LIVE EXAMPLE                                              │
│    ┌──────────────────────────────────────────────────┐     │
│    │ (embedded RenderDocument from showcase slug)     │     │
│    └──────────────────────────────────────────────────┘     │
│                                                              │
│    ────────────────────────────────────────────────────     │
│                                                              │
│    $ npm install -g @howicc/cli                              │
│    $ howicc login                                            │
│    $ howicc sync                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /shared/:showcase-slug
  → RenderDocument for embedded example
  → Cache: indefinite, static
```

#### Key Elements

| Element | Spec |
|---------|------|
| Headline | display (32px), `--text-primary`, 48px top margin |
| Subhead | body (14px), `--text-secondary`, max-width 480px |
| CTAs | Primary button (green) + secondary (gray) |
| Example card | Full RenderDocument render, bordered container |
| Install block | Code block, `--surface-raised`, 16px padding |

#### States

- **Loading example:** `Loading example session._` blinking cursor
- **Example fetch fails:** Fall back to static pre-generated HTML snapshot
- **CLI install code:** Always visible, no state variation

#### Interactions

- Sign in button → `/login`
- How it works → smooth scroll to example (NO smooth scroll — instant jump)
- Example "Read full session" → `/s/:showcase-slug`

#### Responsive

- Desktop: Full hero, side-by-side CTAs
- Mobile: Stacked CTAs, narrower container, smaller display size (24px)

---

### Screen 2: Login (`/login`)

#### Purpose

GitHub OAuth entry point.

#### Layout

```
                        ┌──────────────────────────────┐
                        │                              │
                        │  SIGN IN TO HOWICC           │
                        │                              │
                        │  [ CONTINUE WITH GITHUB ]    │
                        │                              │
                        │  Requires repo scope to      │
                        │  verify repository access.   │
                        │                              │
                        │  No code access.             │
                        │  No webhooks.                │
                        │                              │
                        └──────────────────────────────┘
```

Centered, 400px max-width, 1px border, 32px padding.

#### Data Binding

None. OAuth redirect.

#### States

- **Default:** Ready to click
- **Redirecting:** Button text becomes `REDIRECTING..._`

---

### Screen 3: Home (`/home`)

#### Purpose

Authenticated user's landing page. Shows recent sessions and key stats.

#### Layout

Two-column split. Main feed (65%) left, stats sidebar (35%) right.

```
┌───────────────────────────────────────────────────────────────┐
│ HowiCC   > Home  Sessions  Insights          abdallah  [▼]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  RECENT SESSIONS (119)                        [ SEE ALL → ]   │
│  ┌─────────────────────────────┐ ┌─────────────────────────┐ │
│  │                             │ │ STATS                    │ │
│  │ [session row]               │ │                          │ │
│  │ [session row]               │ │ 119 sessions             │ │
│  │ [session row]               │ │ 96.2 hours               │ │
│  │ [session row]               │ │                          │ │
│  │ [session row]               │ │ ┌──────────────────────┐ │ │
│  │ [session row]               │ │ │   $47.80             │ │ │
│  │ [session row]               │ │ │   total cost         │ │ │
│  │ ...                         │ │ └──────────────────────┘ │ │
│  │                             │ │                          │ │
│  │ [ LOAD MORE ]               │ │ ┌──────────────────────┐ │ │
│  │                             │ │ │   2-DAY STREAK       │ │ │
│  │                             │ │ │   longest: 4         │ │ │
│  │                             │ │ └──────────────────────┘ │ │
│  │                             │ │                          │ │
│  │                             │ │ TOP REPOS                │ │
│  │                             │ │ really-app          47   │ │
│  │                             │ │ howicc              34   │ │
│  │                             │ │ really-data         18   │ │
│  │                             │ │                          │ │
│  │                             │ │ [ SEE INSIGHTS → ]       │ │
│  └─────────────────────────────┘ └─────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /profile/stats           → Sidebar
  Response: { sessionCount, totalHours, totalCostUsd,
              currentStreak, longestStreak,
              topRepos: [{ fullName, sessionCount }] }
  Cache:    30s TTL

GET /profile/activity?limit=20  → Feed
  Response: { sessions: SessionActivityEntry[], nextCursor }
  Cache:    60s TTL
```

#### Key Elements

**Session Row** — the atomic unit of the feed:

```
● Add user profile system
  howicc · building
  268 msgs · 7.6h · $2.14                  [private]    2h ago
```

| Field | Source | Style |
|-------|--------|-------|
| Dot | static | 8px green if status=ready, gray if draft |
| Title | `session.title` | body, primary color |
| Repo | `session.repository.fullName` | small, muted |
| Type | `session.sessionType` | small, muted |
| Metrics | derived | small, muted, dot-separated |
| Visibility | `session.visibility` | badge component |
| Time | `session.updatedAt` relative | small, muted, right-aligned |

Row hover: left border becomes 2px green, background becomes `--surface-raised`.
Click: navigate to `/s/:slug`.

**Stat Block** — the sidebar atom:

```
┌──────────────────────────┐
│   $47.80                 │
│   total cost             │
└──────────────────────────┘
```

- Number in title-1 (24px), green
- Label in small (12px), muted
- 1px border, 16px padding
- 100% width of sidebar column

#### States

- **Empty** (`digestCount === 0`): Replace feed with CLI install instructions.
  Hide sidebar stats.
- **Loading:** First render shows header and "Loading sessions.._" placeholder.
- **Error:** `ERR: Could not load sessions. [ RETRY ]`

#### Interactions

- Click row → `/s/:slug`
- Click repo name inside row → `/r/:owner/:name`
- Click `SEE ALL` → `/sessions`
- Click `SEE INSIGHTS` → `/insights`
- Click stat block → `/insights` (jump to relevant section)
- Keyboard: `j`/`k` to move selection up/down, `enter` to open

#### Responsive

- **Desktop ≥1024:** 2-column split
- **Tablet:** 1-column, stats become a horizontal strip above the feed
- **Mobile:** 1-column, stats become inline text above the feed

---

### Screen 4: Insights (`/insights`)

#### Purpose

Analytics deep-dive. "How am I using Claude Code?"

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Insights                            [ LAST 90 DAYS    v ]  │
│                                                              │
│  ┌─── ACTIVITY HEATMAP ───────────────────────────────────┐ │
│  │                                                         │ │
│  │ (full-width GitHub-style grid in green shades)          │ │
│  │                                                         │ │
│  │ 16 active days · peak 23:00-02:00 · busiest Thursday   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── SESSION TYPES ──────┬─── TOP REPOS ───────────────┐   │
│  │                         │                              │   │
│  │ building  ████████ 56   │ axetay/really-app  47 · 136h│   │
│  │ debugging █████    34   │ personal/howicc    34 ·  96h│   │
│  │ exploring ██       18   │ axetay/really-data 18 ·  42h│   │
│  │ investigate █       7   │ axetay/branding     8 ·  12h│   │
│  │ mixed     █         4   │                              │   │
│  └─────────────────────────┴─────────────────────────────┘   │
│                                                              │
│  ┌─── TOOL CRAFT ─────────┬─── LANGUAGES ─────────────────┐ │
│  │                         │                                │ │
│  │ write    ████████ 42%   │ TypeScript  ████████████ 68%  │ │
│  │ command  ████████ 38%   │ Python      ████        22%   │ │
│  │ read     █████   16%    │ SQL         █            5%   │ │
│  │ agent    █        3%    │ YAML        ░            3%   │ │
│  │ plan     ░        1%    │ Other       ░            2%   │ │
│  │                         │                                │ │
│  │ error rate: 2.1%        │ 1,203 files changed           │ │
│  │ rejection rate: 4.2%    │ 3,847 files read              │ │
│  └─────────────────────────┴───────────────────────────────┘ │
│                                                              │
│  ┌─── MODELS ─────────────────────────────────────────────┐ │
│  │ claude-sonnet-4  98 sessions · 3.8M tokens · $38.42   │ │
│  │ claude-opus-4    21 sessions · 0.9M tokens · $9.38    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /profile  → Full UserProfile for all panels
  Cache: 5 min TTL, recomputes on next /profile fetch after new digest
```

#### Key Elements

**Activity Heatmap** (ASCII):

Rendered as a monospace grid of block characters (░ ▒ ▓ █). Five levels based
on session count per day:
- 0 sessions: `░` muted gray
- 1 session: `░` brighter gray
- 2-3: `▒` green dim
- 4-6: `▓` green mid
- 7+: `█` green bright

Tooltip on hover shows date and count.

**Bar Chart Widget** (ASCII):

```
building  ████████ 56
```

- Label left (14 chars reserved, padded)
- Bar middle (scales to max width minus label and number)
- Number right
- Uses `█` for filled, `░` for unfilled
- Green foreground

**Horizontal Divider With Label:**

```
─── SESSION TYPES ──────────────────
```

Used as subsection headers inside the Insights grid. Always `───` (three em-dash)
on each side of the label.

#### States

- **Loading:** Each widget shows `LOADING..._` blinking
- **Empty:** `AWAITING DATA` in muted gray, grayed-out bars
- **Error:** `ERR: profile aggregation failed.`

#### Interactions

- Hover heatmap cell → tooltip `Oct 12, 2026: 45 sessions`
- Click heatmap cell → `/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Click repo in Top Repos → `/r/:owner/:name`
- Hover tool bar → tooltip with exact count
- Date range selector → refetches profile with date filter

#### Responsive

- **Desktop:** 2-column grid of widgets
- **Tablet:** 1-column stack, heatmap scrolls horizontally
- **Mobile:** 1-column, heatmap scrolls, all widgets full width

---

### Screen 5: Sessions (`/sessions`)

#### Purpose

Filterable list of all sessions.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Sessions (119)                                              │
│                                                              │
│  > search sessions...                                        │
│  [All repos v] [All types v] [All v] [Date v] [Sort v]      │
│                                                              │
│  Showing 119 · 96.2h · $47.80                                │
│                                                              │
│  TITLE                    REPO         TYPE    DUR   COST V │
│  ─────                    ────         ────    ───   ────  ─ │
│  Add user profile system  howicc       build   7.6h  $2.14 p │
│  Fix auth middleware      really-app   debug   1.2h  $0.45 u │
│  Explore caching strategy really-app   explore 0.4h  $0.12 p │
│  ...                                                         │
│                                                              │
│  ← 1  2  3  4  5  6 →                                       │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /profile/activity?repo=&type=&visibility=&from=&to=&sort=&page=&q=
  Response: { sessions, total, totalDuration, totalCost, page, hasMore }
  Cache: 30s per filter combination
```

#### Key Elements

**Filter Bar:** Sticky below the page title. Select components in a row.
Each dropdown is a 32px pill-less button with `v` suffix.

**Table:** Brutalist table component. 32px rows. Hover highlights row.
Columns sortable via header click.

#### States

- **Loading:** `Loading sessions.._`
- **Empty (filters):** `No sessions match. [ CLEAR FILTERS ]`
- **Empty (no sessions):** Redirect-like CLI install block
- **Error:** `ERR: query failed. [ RETRY ]`

#### Interactions

- Click row → `/s/:slug`
- Click column header → sort by that column
- Type in search → debounced fetch after 300ms
- Filters update URL query params (shareable)

#### Responsive

- **Desktop:** Table with all columns
- **Tablet:** Card list (each session as a session row, same as /home)
- **Mobile:** Card list, filter bar collapses to a `[ 🎛 FILTERS ]` button

---

### Screen 6: Conversation Detail (`/s/:slug`)

**The most complex screen. The product's primary view.**

#### Purpose

Read a full AI-assisted coding session with narrative structure and metadata.

#### Layout

Three-column on desktop: phase spine, main content, context sidebar.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Home                                                          │
│                                                                  │
│  Add user profile system with digest extraction                  │
│  personal/howicc · chore/howicc-revamp-foundation                │
│  268 msgs · 435 tools · 7.6h · ~$2.14 · building                │
│                                                                  │
│  [ VISIBILITY: PRIVATE v ] [ COPY LINK ] [ EXPORT v ]           │
│                                                                  │
│  ┌─────────┐┌─────────────────────────────────┐┌─────────────┐ │
│  │ PHASES  ││ MAIN CONTENT (50ch max-width)   ││ CONTEXT     │ │
│  │         ││                                 ││             │ │
│  │ > Plan  ││ ┌─ PLAN ───────────────────┐   ││ SESSION     │ │
│  │ | Invest││ │ ## User Profile System   │   ││ Created 2h  │ │
│  │ | Build ││ │ (markdown body)          │   ││ Model son-4 │ │
│  │ | Valid ││ │             [SHOW FULL v]│   ││ Cache 96.7% │ │
│  │ | Sum   ││ └──────────────────────────┘   ││             │ │
│  │         ││                                 ││ FILES (33)  │ │
│  │         ││ ─── INVESTIGATING ─────────── ││ service.ts  │ │
│  │         ││                                 ││ schema.ts   │ │
│  │         ││ [USER]                         ││ assets.ts   │ │
│  │         ││ I've reviewed the revamp docs  ││ [ +30 ]     │ │
│  │         ││                                 ││             │ │
│  │         ││ [▸ Explored codebase · 12]    ││ ARTIFACTS   │ │
│  │         ││                                 ││ 1 plan      │ │
│  │         ││ [ASSISTANT]                    ││ 18 decisions│ │
│  │         ││ The plan is approved...        ││ 3 questions │ │
│  │         ││                                 ││ 5 todos     │ │
│  │         ││ ─── BUILDING ──────────────── ││             │ │
│  │         ││                                 ││ SUBAGENTS   │ │
│  │         ││ [? Question]                   ││ 3 Explore   │ │
│  │         ││  "Should I start with P1?"     ││ 1 Plan      │ │
│  │         ││  ● Phase 1 and 2 together      ││ 5 general   │ │
│  │         ││                                 ││             │ │
│  │         ││ [▸ Built service · 47 runs]   ││ TOOLS       │ │
│  │         ││                                 ││ Bash   145  │ │
│  │         ││ [!] Hook blocked: lint failed  ││ Edit   129  │ │
│  │         ││                                 ││ Read    84  │ │
│  │         ││ [⁘ Subagent · Explore · 106]  ││             │ │
│  │         ││                                 ││             │ │
│  │         ││ ─── VALIDATING ─────────────── ││             │ │
│  │         ││                                 ││             │ │
│  │         ││ [▸ Ran tests · 23 runs]       ││             │ │
│  │         ││                                 ││             │ │
│  │         ││ ─── SUMMARY ────────────────── ││             │ │
│  │         ││                                 ││             │ │
│  │         ││ [ASSISTANT]                    ││             │ │
│  │         ││ All tests pass. Summary...     ││             │ │
│  │         ││                                 ││             │ │
│  └─────────┘└─────────────────────────────────┘└─────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Data Binding

Owner view:
```
GET /conversations/:id          → Header metadata
GET /conversations/:id/render    → RenderDocument for blocks
GET /conversations/:id/digest    → Sidebar context
PATCH /conversations/:id/visibility  → Visibility dropdown
```

Public view:
```
GET /shared/:slug    → Everything (metadata + render + minimal digest)
```

#### Phase Spine Detection

Phase detection runs client-side on the RenderDocument. Heuristics:

```
PHASE              SIGNAL
─────              ──────
Plan               Presence of plan artifact in context.currentPlan
Investigating      Block run dominated by Read/Glob/Grep activity groups
                   + assistant messages with no code output
Planning           Presence of question blocks
                   OR plan creation activity
Building           Block run dominated by Write/Edit activity groups
Validating         Block run dominated by Bash test/typecheck activity groups
Summary            Terminal assistant message after activity stops
```

Walk the block list; whenever the dominant activity type changes for ≥3 blocks,
insert a phase boundary. Render as a divider with the phase label.

Phases appear in the left spine. As the user scrolls, the current phase is
detected via IntersectionObserver and highlighted with a `>` prefix + green color.

#### Block Rendering

Each of the 11 RenderBlock types has a dedicated component:

```
BLOCK                  RENDERED AS
─────                  ───────────
MessageBlock           [USER] or [ASSISTANT] label + markdown body
                       User: surface-raised bg, left border 2px subtle
                       Assistant: no bg, left border 2px green

QuestionBlock          [?] prefix + title in tiny uppercase
                       Options listed with ● (selected) or ○ (not)
                       Outcome shown as muted small text below

ActivityGroupBlock     [▸] prefix + label + tool count
                       Collapsed by default
                       Click to expand, showing each tool row indented

CalloutBlock           [!] prefix for warnings
                       [i] prefix for info
                       [x] prefix for errors
                       Colored border matching tone

TodoBlock              Checklist with [x], [ ], [-] status markers

TaskTimelineBlock      Vertical line with task status changes
                       Each entry: status, description, delta

ResourceBlock          [@] prefix + title + uri
                       Collapsed preview, expand to full

StructuredDataBlock    [{}] prefix + title
                       Collapsed JSON viewer

BriefDeliveryBlock     [✉] prefix + title + attachments

SubagentThreadBlock    [⁘] prefix + title + event count
                       Collapsed by default
                       Expand shows nested block list with left indent

CompactBoundaryBlock   Horizontal divider with text:
                       ─── CONVERSATION COMPACTED ───
```

#### States

- **Loading:** Full-page skeleton with phase spine visible but empty
- **Loading render doc:** `Loading conversation.._`
- **404:** `ERR: Conversation not found or made private.`
- **No access:** Same 404 (don't confirm existence)

#### Interactions

- Phase click → scroll to phase, highlight
- Scroll → update phase spine active state (IntersectionObserver)
- Activity group click → expand/collapse
- Subagent thread click → expand/collapse (recursive)
- Visibility dropdown → optimistic update + API call
- Copy link button → `navigator.clipboard.writeText(url)` + toast
- Export dropdown → canonical JSON, render JSON, markdown

**Keyboard shortcuts:**
- `j/k` — scroll down/up through blocks
- `p` — previous phase
- `n` — next phase
- `e` — expand all activity groups
- `c` — collapse all activity groups
- `/` — focus find-in-page

#### Responsive

- **Desktop (≥1024):** 3-column with phase spine left, context right
- **Tablet:** Phase spine becomes horizontal chips at top, context becomes drawer
- **Mobile:** Phase spine is sticky horizontal scroll, no context sidebar,
  info in bottom sheet triggered by `[i]` icon

---

### Screen 7: Public Profile (`/@:username`)

#### Purpose

Viral, shareable public profile page. Opt-in. Must work as a landing page.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HowiCC                              [ CREATE YOUR OWN → ]  │
│                                                              │
│  ┌── HERO ──────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  ┌─────┐                                              │   │
│  │  │ AO  │   Abdallah Othman                            │   │
│  │  │  ●  │   @abdallah                                  │   │
│  │  └─────┘   github.com/abdallah · axetay.com           │   │
│  │                                                       │   │
│  │  119 sessions · 96 hours · 42-day streak             │   │
│  │                                                       │   │
│  │  ┌───────────┐┌───────────┐┌───────────┐             │   │
│  │  │ BUILDER   ││ NIGHT OWL ││ EXPLORER  │             │   │
│  │  │ 47% build ││ peak 23:00││ top 10%   │             │   │
│  │  └───────────┘└───────────┘└───────────┘             │   │
│  │                                                       │   │
│  │  [ SHARE PROFILE ]                                    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ── ACTIVITY ─────────────────────────────────────────       │
│                                                              │
│  (year-long heatmap, same component as /insights)            │
│                                                              │
│  ── WHO I AM ─────┬── WHAT I BUILD WITH ──────────          │
│                    │                                         │
│  SESSION TYPES     │ LANGUAGES                               │
│  (ASCII bars)      │ (ASCII bars)                            │
│                    │                                         │
│                    │ TOP TOOLS                               │
│                    │ (ASCII bars)                            │
│                                                              │
│  ── PUBLIC SESSIONS (8) ───────────────────────────         │
│                                                              │
│  ┌───────────────────┐ ┌───────────────────┐                │
│  │ Session card 1    │ │ Session card 2    │                │
│  └───────────────────┘ └───────────────────┘                │
│                                                              │
│  ── WORKS ON ─────────────────────────────────────          │
│                                                              │
│  ● axetay/really-app       47 sessions                       │
│  ● personal/howicc         34 sessions                       │
│                                                              │
│  ── CTA ──────────────────────────────────────────          │
│                                                              │
│     Create your own HowiCC profile in 30 seconds.            │
│     [ SIGN IN WITH GITHUB → ]                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /profile/public/:username
  Response: { user, publicSettings, stats, badges, activity?,
              sessionTypes?, languages?, topTools?, publicSessions,
              publicRepos?, cost? }
  Cache: 5 min edge TTL
  Fields filtered by user's publicSettings toggles

GET /og/profile/:username.png
  Generated OG image for social card meta tags
  Cache: 1 hour edge TTL
```

#### Key Elements

**Hero ASCII Avatar** (optional, future):
Converted from GitHub avatar to ASCII art via server-side render. Fallback to
initials in a sharp square with green border.

**Badge Component:**
```
┌───────────────┐
│ BUILDER       │
│ 47% build     │
└───────────────┘
```
1px green border, tiny uppercase label, small description below.

**Public Session Card:**
```
┌─────────────────────────────────┐
│ Fix auth middleware             │
│ really-app · debugging          │
│                                 │
│ "The auth middleware is         │
│  rejecting valid session..."    │
│                                 │
│ 42 msgs · 1.2h · 248 views      │
└─────────────────────────────────┘
```
Border, title, repo/type, excerpt (italic forbidden — use small muted),
metrics row at bottom. Hover: left border green.

#### States

- **Profile not public:** 404 `ERR: User not found or profile not public.`
- **No public sessions:** Show hero + stats, replace sessions grid with
  "No public sessions yet."
- **Loading:** `Loading profile..._`

#### Interactions

- Share button → `navigator.share()` on mobile, clipboard copy on desktop
- Click session card → `/s/:slug`
- Click repo → `/r/:owner/:name`
- CTA button → `/login`
- Click badge → tooltip with criteria explanation

#### Responsive

- **Desktop:** 800px max-width, centered
- **Tablet:** Full width with 32px margin
- **Mobile:** Full width, 16px margin, hero stacks

---

### Screen 8: Repository Page (`/r/:owner/:name`)

#### Purpose

Team view for a specific repo. GitHub permission-gated.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  axetay/really-app                    Your role: contributor│
│  47 sessions · 3 contributors · members visibility           │
│                                                              │
│  ── AGGREGATE ────────────────────────────────────           │
│  136.2h duration · $38.40 est cost · 12,847 tool runs       │
│  build 24 · debug 14 · explore 6 · investigate 3            │
│                                                              │
│  ── CONTRIBUTORS ────────────────────────────────            │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐          │
│  │ abdallah              │ │ sarah                 │          │
│  │ 32 sessions · 94h     │ │ 10 sessions · 28h     │          │
│  │                       │ │                       │          │
│  │ build  ████████ 18    │ │ build  ████ 6         │          │
│  │ debug  █████    10    │ │ debug  ██   3         │          │
│  │ explore ██        4   │ │ explore █   1         │          │
│  │                       │ │                       │          │
│  │ Top: TypeScript       │ │ Top: TypeScript       │          │
│  │ Last active: 2h ago   │ │ Last active: 1d ago   │          │
│  │ [ VIEW SESSIONS ]     │ │ [ VIEW SESSIONS ]     │          │
│  └───────────────────────┘ └───────────────────────┘          │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │ carlos                │                                   │
│  │ 5 sessions · 14h      │                                   │
│  │ build  ██ 3           │                                   │
│  │ debug  █  2           │                                   │
│  │ Last active: 3d ago   │                                   │
│  │ [ VIEW SESSIONS ]     │                                   │
│  └───────────────────────┘                                   │
│                                                              │
│  ── LANGUAGES & TOOLS ──────────────────────────             │
│  TypeScript ██████████ 78  │  write   ████████ 45%          │
│  Python     ████       32  │  command ████████ 40%          │
│  SQL        ██         14  │  read    █████   12%           │
│  YAML       █           8  │  agent   █        3%           │
│                                                              │
│  ── RECENT SESSIONS ─────────────────────────                │
│                                                              │
│  ● Fix auth middleware    abdallah  debug  1.2h  $0.45      │
│  ● Add caching layer      sarah     build  2.4h  $0.89      │
│  ● Debug deploy failure   abdallah  debug  0.8h  $0.30      │
│                                                              │
│  [ LOAD MORE ]                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /repos/:owner/:name    nature: live (GitHub API)
  Server-side flow:
    1. Verify user via HowiCC session
    2. Look up GitHub OAuth token
    3. Call GitHub API to check permissions
    4. Map permission → role (admin / contributor / reader)
    5. If no access → 403
    6. Query D1 for aggregate stats, conversations, digests
    7. Apply visibility rules
    8. Apply admin overrides
    9. Return filtered response
  Cache: 5 min per user+repo pair

PATCH /repos/:owner/:name/conversations/:id/repo-visibility
  Used by admin [⋯] menu
```

#### Key Elements

**Contributor Card:**
```
┌──────────────────────┐
│ abdallah              │
│ 32 sessions · 94h     │
│                       │
│ build  ████████ 18    │
│ debug  █████    10    │
│ explore ██        4   │
│                       │
│ Top: TypeScript       │
│ Last active: 2h ago   │
│ [ VIEW SESSIONS ]     │
└──────────────────────┘
```

280px wide, 1px border, 16px padding. Hover: border becomes green.
Inline ASCII bar charts for session types.

**Admin Menu** (admin/maintainer only):

Each session row has a trailing `[⋯]` button. Click opens an inline dropdown:
```
  [⋯]
  ├─ VIEW
  ├─ HIDE FROM REPO PAGE
  └─ COPY LINK
```

Hidden conversations appear in a separate collapsed section at the bottom.

#### States

- **No access (404):** `ERR: Repository not found or no access.`
- **Loading:** `Verifying repository access..._`
- **Empty:** `No sessions synced from this repository yet.`

#### Interactions

- Click contributor card → drill down to that contributor's sessions in this repo
- Click session row → `/s/:slug`
- Admin `[⋯]` → dropdown menu
- Click `[ VIEW SESSIONS ]` → filtered sessions view

#### Responsive

- **Desktop:** Contributor cards in 2-column grid
- **Tablet:** Single column
- **Mobile:** Single column, cards full width

---

### Screen 9: Repository Settings (`/r/:owner/:name/settings`)

#### Purpose

Admin-only page for repo visibility and moderation.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← axetay/really-app                                         │
│                                                              │
│  Repository Settings                                         │
│                                                              │
│  ── VISIBILITY ──────────────────────────────────            │
│                                                              │
│  Who can see this repository's page on HowiCC?               │
│                                                              │
│  ● Private                                                   │
│    Only admins can see it.                                   │
│                                                              │
│  ○ Members                                                   │
│    People with GitHub push access can see aggregate stats.   │
│                                                              │
│  ○ Public                                                    │
│    Anyone can see aggregate stats.                           │
│                                                              │
│  [ SAVE CHANGES ]                                            │
│                                                              │
│  ── HIDDEN CONVERSATIONS ────────────────────────            │
│                                                              │
│  Hidden from repo page. Owners can still share via direct    │
│  link.                                                       │
│                                                              │
│  TITLE                  HIDDEN BY    DATE         ACTION     │
│  ─────                  ─────────    ────         ──────     │
│  Debugging prod secrets abdallah     2d ago      [ UNHIDE ] │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /repos/:owner/:name    (re-verify admin role)
PATCH /repos/:owner/:name/visibility
PATCH /repos/:owner/:name/conversations/:id/repo-visibility { hidden: false }
```

---

### Screen 10: Settings (`/settings`)

#### Purpose

Account, profile visibility, CLI tokens.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                    │
│                                                              │
│  ── ACCOUNT ─────────────────────────────────────            │
│                                                              │
│  Name:    Abdallah Othman                                    │
│  Email:   abdallah@example.com                               │
│  GitHub:  @abdallah (repo, user:email)                       │
│                                                              │
│  [ DELETE ACCOUNT ]                                          │
│                                                              │
│  ── PUBLIC PROFILE ──────────────────────────────            │
│                                                              │
│  Your profile will be visible at:                            │
│  howi.cc/@abdallah                                           │
│                                                              │
│  [x] Make profile public                                     │
│  [x] Show activity heatmap                                   │
│  [ ] Show cost estimate                                      │
│  [x] Show repositories                                       │
│  [x] Show session types                                      │
│  [x] Show tools and languages                                │
│  [x] Show badges                                             │
│                                                              │
│  [ SAVE CHANGES ]                                            │
│                                                              │
│  ── CLI TOKENS ──────────────────────────────────            │
│                                                              │
│  Most users don't need these. `howicc login` creates         │
│  tokens automatically via browser-based auth.                │
│                                                              │
│  TOKEN        CREATED     LAST USED    STATUS               │
│  ─────        ───────     ─────────    ──────               │
│  hwi_a3f7...  Apr 2       2h ago       Active  [ REVOKE ]  │
│  hwi_8b2d...  Mar 15      7d ago       Revoked              │
│                                                              │
│  [ CREATE NEW TOKEN ]                                        │
└──────────────────────────────────────────────────────────────┘
```

#### Data Binding

```
GET /auth/session         Better Auth user info
GET /profile              For digest count display
GET /api-tokens           Token list
POST /api-tokens          Create
DELETE /api-tokens/:id    Revoke
PATCH /profile/settings   Profile visibility toggles
```

---

## 8. Interaction Patterns

### Hover States

**Rule: Hover changes color, not position or shadow.**

```
ELEMENT              HOVER CHANGE
───────              ────────────
Button primary       Fill from transparent to green, text to black
Button secondary     Fill from transparent to gray, text to black
Button ghost         Text color from gray to green
Session row          Background to surface-raised, left border to 2px green
Card                 Border color from subtle to default
Nav link             Text color from muted to primary
Table row            Background to surface-raised
```

**No transitions on hover.** Instant swap. The brutalism rejects easing functions.

### Focus States

**Rule: Focus is visible via outline, only for keyboard users.**

```css
*:focus-visible {
  outline: 2px solid var(--terminal-green);
  outline-offset: 2px;
}
```

Use `:focus-visible` (not `:focus`) so mouse clicks don't show outlines.
All focusable elements must have a visible focus style. No removing outlines
for "aesthetic" reasons.

### Click/Tap States

**Rule: Active state inverts the hover.**

```
ELEMENT              ACTIVE CHANGE
───────              ─────────────
Button               Background darker, scale: 1 (NO scale transform)
Link                 Color dims slightly (active pseudo-class)
```

No ripples. No scale animations. Clicks feel instant.

### Loading Patterns

Three loading patterns, depending on context:

**1. Blinking cursor** (indeterminate, short):
```
Loading._
```
```css
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.cursor { animation: blink 1s step-end infinite; }
```

**2. Progress bar** (determinate):
```
[████████░░] 80%
```
Rendered via text replacement on state change, not a DOM animation.

**3. Skeleton rows** (content placeholder):
```
────────────
──────
────────
```
Replaces the first render of lists. Fixed character length, muted color.

### Error States

**Rule: Errors are literal, instructive, and never blamed on the user.**

```
  ERR: Could not load profile.
       Check your connection.
       [ RETRY ]
```

```
  ERR: Token revoked.
       Generate a new one and run `howicc login` again.
```

```
  ERR: GitHub rate limit exceeded.
       Try again in 15 minutes.
```

Always prefix with `ERR:`. Always use `var(--text-error)`. Include an action
the user can take. Never use phrases like "Something went wrong" or "Oops!".

### Success Confirmations

**Toast + optimistic update:**

```
  OK  Visibility updated to public.
```

Toast appears bottom-right for 4 seconds, then dismisses. The underlying UI
updates immediately — don't wait for the API call.

### Empty States

Already covered in Component Library. Always instructional. Always include
a specific action or command.

### Keyboard Shortcuts

HowiCC is keyboard-friendly by default. Each page has shortcuts:

**Global:**
- `/` — focus search (where applicable)
- `g h` — go home
- `g s` — go to sessions
- `g i` — go to insights
- `ESC` — close modal, clear selection

**Home / Sessions feed:**
- `j` / `k` — next / previous row
- `enter` — open selected row
- `r` — refresh

**Conversation Detail:**
- `j` / `k` — scroll by block
- `p` / `n` — previous / next phase
- `e` — expand all
- `c` — collapse all
- `s` — copy share link

**Discoverability:** Press `?` anywhere to show a keyboard shortcut modal.

---

## 9. Motion and Animation

### What Moves

**Only three things animate:**

1. **Blinking cursor** — `animation: blink 1s step-end infinite`
2. **Progress bars** — updates via text replacement, no CSS transition
3. **Page scroll** — native browser scroll (no smooth scroll behavior)

### What Does Not Move

- Hover states (instant swap)
- Modal open/close (instant)
- Toast appearance (instant)
- Tab switches (instant)
- Dropdown open (instant)
- Focus changes (instant)
- Button clicks (no ripple, no scale)

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .cursor { animation: none; }
}
```

Even the cursor stops blinking when the user has reduced motion enabled. This
preference is respected absolutely.

### Why

Animations communicate nothing in a well-designed static interface. The reason
most UIs animate is because they lack clarity — animations cover up the user's
confusion about what changed. Brutalist design makes every state change obvious
via color and position, so animation is unnecessary.

---

## 10. Content and Voice

### Writing Principles

1. **Terse.** Shorter is better. Cut unless cutting hurts meaning.
2. **Literal.** "Create token" not "Generate new credentials."
3. **Technical.** Assume the reader knows what a CLI is.
4. **Numbered.** Show numbers where they exist. Don't describe when you can count.
5. **Imperative.** "Run `howicc sync`" not "You could try running..."

### Capitalization

```
CATEGORY            STYLE                     EXAMPLE
────────            ─────                     ───────
Page titles         Sentence case             "Repository settings"
Section headers     UPPERCASE                 "RECENT SESSIONS"
Button labels       UPPERCASE                 "CREATE TOKEN"
Tab labels          UPPERCASE                 "ACCOUNT", "TOKENS"
Badge labels        lowercase in brackets     "[private]"
Field labels        Sentence case             "Email address"
Field hints         Sentence case             "We'll only use this to..."
Errors              `ERR:` prefix             "ERR: Connection refused."
Success             `OK ` prefix              "OK Saved."
Commands            lowercase monospace       "`howicc sync`"
File paths          as-is monospace           "`apps/web/src/...`"
Session types       lowercase                 "building", "debugging"
```

### Number Formatting

```
CASE                FORMAT         EXAMPLE
────                ──────         ───────
Session counts      plain          "119 sessions"
Durations           human          "7.6h", "96.2h", "42 min"
Costs               $ prefix, 2dp  "$2.14", "$47.80"
Tokens              compact        "3.8M tokens", "128K"
Percentages         integer %      "47%", "96%"
Counts              thousands      "12,847 tool runs"
Streaks             "X-day"        "42-day streak"
```

### Labels and Actions

| Good | Bad |
|------|-----|
| CREATE TOKEN | Generate new access credentials |
| REVOKE | Delete token |
| HIDE FROM REPO PAGE | Remove this session from the repository overview |
| No sessions synced yet. | Oh no, there's nothing to show! |
| ERR: Could not load profile. | Something went wrong. Please try again later. |
| $47.80 | Approximately forty-eight dollars spent |

### Error Messages

Template: `ERR: <what happened>. <what to do>.`

```
  ERR: Token revoked. Generate a new one.
  ERR: GitHub rate limit exceeded. Try again in 15 minutes.
  ERR: Session not found. It may have been made private.
  ERR: Sync failed. Check your network and run `howicc sync` again.
  ERR: Access denied. You need repo write access to see this.
```

### Success Messages

Template: `OK <what just happened>.`

```
  OK  Token copied to clipboard.
  OK  Visibility changed to public.
  OK  Session hidden from repo page.
  OK  Profile settings saved.
```

---

## 11. Accessibility

### Color Contrast

All color combinations meet WCAG AA for normal text and AAA for large text.

```
COMBINATION                     RATIO     PASSES
───────────                     ─────     ──────
#F3F3F3 on #000000              18.9:1    AAA
#00FF41 on #000000              15.3:1    AAA
#888888 on #000000              5.7:1     AA
#FF003C on #000000              4.8:1     AA for large, fails normal
```

**Exception:** `#FF003C` (error red) on black fails AA for normal text size.
Mitigation: error messages always include a non-color indicator (prefix `ERR:`)
so meaning doesn't depend on color alone.

### Keyboard Navigation

Every interactive element must be reachable via keyboard:
- Tab order follows visual order (no `tabindex` hacks)
- All buttons, links, inputs are natively focusable
- Custom components use `role` + keyboard event handlers
- Modals trap focus within themselves
- Skip-to-content link at the top of every page

### Screen Reader Support

- Semantic HTML first (`<nav>`, `<main>`, `<article>`, `<table>`, `<button>`)
- ARIA only where semantic HTML falls short
- `aria-label` for icon-only buttons (there shouldn't be many)
- `aria-live="polite"` for toasts and dynamic status updates
- `aria-expanded` for collapsible activity groups
- Table headers linked to cells via `scope="col"` / `scope="row"`

### Focus Indicators

Strong, visible focus indicators for keyboard users. Never remove outlines for
aesthetic reasons.

```css
*:focus-visible {
  outline: 2px solid var(--terminal-green);
  outline-offset: 2px;
}
```

### Reduced Motion

Respected absolutely. Even the blinking cursor stops.

### Color Blindness

The palette works for all common color blindness types because:
- High contrast brightness between green and background
- Error red paired with `ERR:` text prefix
- Visibility badges use text, not color
- No color-only signals for state

### Text Sizing

Users can zoom the page to 200% without layout breakage. Monospace at 14px is
comfortable at default zoom; zoomed to 28px it's still readable.

### ASCII Art Accessibility

The activity heatmap and ASCII bar charts are decorative visualizations built
from characters. For screen readers, we render:

```html
<div aria-hidden="true">
  ████████ 56
</div>
<span class="sr-only">building: 56 sessions, 47 percent</span>
```

The visual and the semantic version are separated.

---

## 12. Implementation Guide

### Stack

```
LAYER          TECHNOLOGY              RATIONALE
─────          ──────────              ─────────
Framework      Astro                   Existing choice, SSR-first
Styling        Tailwind CSS v4         Existing choice, utility-first
Typography     JetBrains Mono          Only font, self-hosted
Components     Astro + React islands   Interactivity where needed
State          URL params + fetch      Avoid client state libs when possible
Forms          Native HTML + server    No form library
Charts         ASCII via text          No chart library
Icons          Text / ASCII            No icon library
```

### File Structure

```
apps/web/
├── src/
│   ├── pages/
│   │   ├── index.astro              /
│   │   ├── login.astro              /login
│   │   ├── home.astro               /home
│   │   ├── insights.astro           /insights
│   │   ├── sessions.astro           /sessions
│   │   ├── settings.astro           /settings
│   │   ├── s/[slug].astro           /s/:slug
│   │   ├── r/[owner]/[name]/
│   │   │   ├── index.astro          /r/:owner/:name
│   │   │   └── settings.astro       /r/:owner/:name/settings
│   │   └── @[username].astro        /@:username
│   │
│   ├── components/
│   │   ├── ui/                      Atomic components
│   │   │   ├── Button.astro
│   │   │   ├── Card.astro
│   │   │   ├── Badge.astro
│   │   │   ├── Table.astro
│   │   │   ├── Input.astro
│   │   │   ├── Select.astro
│   │   │   ├── Modal.astro
│   │   │   ├── Toast.astro
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── NavBar.astro
│   │   │   ├── Footer.astro
│   │   │   └── PageContainer.astro
│   │   ├── feed/
│   │   │   ├── SessionRow.astro
│   │   │   ├── StatBlock.astro
│   │   │   └── ActivityHeatmap.astro
│   │   ├── conversation/
│   │   │   ├── PhaseSpine.tsx       React island
│   │   │   ├── BlockRenderer.astro
│   │   │   ├── MessageBlock.astro
│   │   │   ├── ActivityGroupBlock.tsx  React island (expandable)
│   │   │   ├── QuestionBlock.astro
│   │   │   ├── SubagentThreadBlock.tsx
│   │   │   └── ...
│   │   └── profile/
│   │       ├── Badge.astro
│   │       ├── SessionCard.astro
│   │       └── AsciiAvatar.astro
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts            API fetch wrappers
│   │   ├── auth/                    Better Auth integration
│   │   └── format.ts                Number/date formatters
│   │
│   └── styles/
│       └── global.css               Tailwind + custom tokens
│
├── astro.config.mjs
├── tailwind.config.ts
└── package.json
```

### Tailwind Config

```ts
// tailwind.config.ts
export default {
  content: ['./src/**/*.{astro,tsx,ts}'],
  theme: {
    colors: {
      black:   '#000000',
      white:   '#FFFFFF',
      green:   '#00FF41',
      red:     '#FF003C',
      gray: {
        50:  '#F3F3F3',
        200: '#CCCCCC',
        400: '#888888',
        600: '#555555',
        800: '#333333',
        900: '#111111',
      },
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
    },
    fontSize: {
      tiny:    ['11px', '16px'],
      small:   ['12px', '18px'],
      code:    ['13px', '20px'],
      body:    ['14px', '22px'],
      'title-3': ['16px', '24px'],
      'title-2': ['20px', '28px'],
      'title-1': ['24px', '32px'],
      display: ['32px', '40px'],
    },
    spacing: {
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px',
      16: '64px',
      20: '80px',
    },
    borderRadius: {
      none: '0',
      // No other radius tokens. Radius is banned.
    },
    borderWidth: {
      0: '0',
      DEFAULT: '1px',
      2: '2px',
      // No 3px, 4px. 1px is the rule.
    },
    extend: {
      fontWeight: {
        normal: '400',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
};
```

### Global CSS

```css
/* src/styles/global.css */

@import 'tailwindcss';

/* Font loading */
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

/* Reset and base */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  background: #000000;
  color: #F3F3F3;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}

/* Selection */
::selection {
  background: #00FF41;
  color: #000000;
}

/* Focus */
*:focus { outline: none; }
*:focus-visible {
  outline: 2px solid #00FF41;
  outline-offset: 2px;
}

/* Cursor animation (only animation in the system) */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.cursor-blink::after {
  content: '_';
  animation: blink 1s step-end infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cursor-blink::after { animation: none; }
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Astro Island Strategy

**Server-side by default.** Only hydrate React islands where interactivity
demands it:

| Component | Why client-side |
|-----------|----------------|
| `PhaseSpine.tsx` | IntersectionObserver for active phase tracking |
| `ActivityGroupBlock.tsx` | Expand/collapse state |
| `SubagentThreadBlock.tsx` | Nested expand/collapse |
| `VisibilityDropdown.tsx` | API call + optimistic update |
| `FilterBar.tsx` | URL param sync + search debounce |
| `Toast.tsx` | Dismiss timer |
| `Modal.tsx` | Focus trap |
| `SearchInput.tsx` | Debounced input |

Everything else is static Astro components rendered server-side.

### Data Fetching

**Pattern: SSR fetch + hydrate on the client if needed.**

```astro
---
// src/pages/home.astro
import { apiClient } from '../lib/api/client';
import PageContainer from '../components/layout/PageContainer.astro';
import SessionRow from '../components/feed/SessionRow.astro';
import StatBlock from '../components/feed/StatBlock.astro';

const [stats, activity] = await Promise.all([
  apiClient.getProfileStats(),
  apiClient.getProfileActivity({ limit: 20 }),
]);
---

<PageContainer>
  <div class="grid grid-cols-[65%_35%] gap-0">
    <div>
      <h2 class="text-tiny uppercase text-gray-400 mb-4">
        Recent sessions ({stats.sessionCount})
      </h2>
      {activity.sessions.map((session) => (
        <SessionRow session={session} />
      ))}
    </div>
    <div class="border-l border-gray-800 pl-4">
      <StatBlock label="total cost" value={`$${stats.totalCostUsd.toFixed(2)}`} />
      <StatBlock label={`${stats.longestStreak}-day best`}
                 value={`${stats.currentStreak}-day streak`} />
    </div>
  </div>
</PageContainer>
```

### API Client

```ts
// src/lib/api/client.ts
import type {
  ProfileStats,
  ProfileActivity,
  UserProfile,
  ConversationMeta,
  RenderDocument,
  SessionDigest,
  RepoTeamView,
} from '@howicc/contracts';

const BASE_URL = import.meta.env.API_BASE_URL;

class ApiClient {
  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  getProfileStats() {
    return this.fetch<ProfileStats>('/profile/stats');
  }
  getProfileActivity(params: { limit?: number; cursor?: string } = {}) {
    const q = new URLSearchParams(params as Record<string, string>);
    return this.fetch<ProfileActivity>(`/profile/activity?${q}`);
  }
  getProfile() {
    return this.fetch<UserProfile>('/profile');
  }
  getConversation(id: string) {
    return this.fetch<ConversationMeta>(`/conversations/${id}`);
  }
  getConversationRender(id: string) {
    return this.fetch<RenderDocument>(`/conversations/${id}/render`);
  }
  // ... etc
}

export const apiClient = new ApiClient();
```

### Error Boundaries

Astro pages catch errors via try/catch in the frontmatter. React islands use
error boundaries. All errors render the same brutalist error pattern:

```
ERR: <message>
     [ RETRY ]
```

---

## 13. Build Phases

### Phase 0 — Foundation (Week 0)

```
  ✓  Astro project scaffolded
  ✓  Tailwind + JetBrains Mono + design tokens
  ✓  Global CSS (reset, base, cursor animation)
  ✓  Layout components (NavBar, PageContainer, Footer)
  ✓  Atomic UI components (Button, Card, Badge, Input)
```

### Phase 1 — The Sharing Loop (Week 1-2)

```
  ✓  /s/:slug public view (static RenderDocument display)
  ✓  Block renderer for all 11 block types
  ✓  Phase spine detection and rendering
  ✓  Mobile-first responsive
  ✓  /s/:slug owner view (visibility dropdown)
  ✓  Basic /home feed
```

**Ship criteria:** A user can sync a session and share a public link that
renders beautifully on mobile.

### Phase 2 — Own Your Data (Week 3)

```
  ✓  /sessions list with filters
  ✓  /settings (account + profile visibility + tokens)
  ✓  Empty states throughout
  ✓  Error boundaries
```

**Ship criteria:** A user can manage all their data and settings.

### Phase 3 — Team Features (Week 4-5)

```
  ✓  /r/:owner/:name with GitHub permission check
  ✓  Contributor cards as hero
  ✓  /r/.../settings for admins
  ✓  Hidden conversation moderation
```

**Ship criteria:** A team lead can see AI usage across their repo and
moderate what's shown.

### Phase 4 — Insights and Viral (Week 6-7)

```
  ✓  /insights with heatmap and breakdowns
  ✓  /@:username public profile
  ✓  OG image generation
  ✓  Badge system
  ✓  Polished /landing with embedded example
```

**Ship criteria:** Public profiles are shareable on social and drive sign-ups.

---

## 14. Success Metrics

### Product Metrics

```
  METRIC                       TARGET (Q2)    SIGNAL
  ──────                       ───────────    ──────
  Weekly active users          > 500          Retention
  Sessions synced per week     > 2,500        Core usage
  Public profiles              > 100          Opt-in rate
  Shared links clicked         > 1,000/week   Viral coefficient
  GitHub-verified repos        > 50           Team adoption
  Session detail bounce rate   < 30%          Content quality
  Time on conversation page    > 2 min        Engagement
```

### Design Metrics

```
  METRIC                           TARGET
  ──────                           ──────
  Lighthouse Performance           > 95
  Lighthouse Accessibility         100
  Largest Contentful Paint         < 1.2s
  Cumulative Layout Shift          0
  Time to Interactive              < 2s
  First Input Delay                < 100ms
```

### Brand Recognition

Success = a developer sees a HowiCC screenshot on Twitter and immediately
recognizes it as HowiCC without needing to read the URL. The brutalism is
distinctive enough to be identifiable from a thumbnail.

---

## 15. Open Questions

### Design

1. **Does the phase spine detection work reliably across session types?**
   Needs testing against the workbench v6 data. May need manual override
   (author can tag phases) if auto-detection is unreliable.

2. **How does the activity heatmap scale for 5+ year users?**
   Currently designed for 1-year view. Need horizontal scroll or year picker.

3. **Is JetBrains Mono readable enough at 14px body size?**
   Monospace at 14 can feel cramped. Consider 15px or 16px for long-form
   conversation detail reading.

4. **ASCII avatars — do they actually render well from real GitHub photos?**
   Needs a prototype of the server-side conversion pipeline. May fall back
   to initials-only if quality is poor.

### Product

5. **How do we communicate the visibility ceiling/floor model to users without
   a help doc?**
   The current wireframes include inline explanation but it may be too complex.
   Consider an onboarding modal on first visibility change.

6. **Should the repo page support drill-down into contributors?**
   The contributor cards have a `[ VIEW SESSIONS ]` button but the destination
   isn't designed yet. Options: modal, new page, filtered sessions view.

7. **Badges — should users be able to hide specific badges?**
   All-or-nothing profile settings is simple but may feel limiting. Deferred
   until we see badge usage data.

### Technical

8. **GitHub API rate limits at scale.**
   5000 req/hour per OAuth token. A popular repo page with 100 viewers/day
   hits this quickly. Mitigation: 5-min cache, maybe GitHub App later.

9. **SSR for OG tags on the public profile.**
   Astro supports SSR natively but we need to verify the OG image generation
   integrates cleanly with the edge deployment.

10. **Reserved usernames for `/@:username` routing.**
    Need to block `@home`, `@settings`, `@admin`, `@api`, etc. Use GitHub's
    reserved username list as a starting point.

---

## Related Documents

- [14-repositories-and-project-grouping.md](14-repositories-and-project-grouping.md) — Repo data model
- [15-jtbd-ux-flows-and-user-journey.md](15-jtbd-ux-flows-and-user-journey.md) — User journeys
- [16-team-access-and-github-integration.md](16-team-access-and-github-integration.md) — GitHub auth
- [17-web-app-pages-and-screens.md](17-web-app-pages-and-screens.md) — Page wireframes
- [18-data-and-api-per-page.md](18-data-and-api-per-page.md) — Data and API contracts

---

**Status:** Draft v1 — ready for design review.
**Owner:** Abdallah Othman
**Review cycle:** Weekly until approved.
