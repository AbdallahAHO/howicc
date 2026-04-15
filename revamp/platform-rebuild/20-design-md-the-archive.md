# DESIGN SYSTEM DOCUMENTATION: THE ARCHIVE

A warm alternative to doc 19 (Developer Brutalism). Same structural rigor, same
density, but humanized — in the spirit of Claude's own web surfaces. This is
for developers who want their tools to feel like a well-lit library, not a
dark terminal.

---

## 1. Overview & Creative North Star

### The Creative North Star: "The Archive"

This design system rejects both the cold brutalism of dark developer tools and
the friendly plastic of modern SaaS. It lives in the middle — **editorial,
warm, and deeply craftful.** HowiCC is where thinking is preserved. The
interface should feel like a serious workshop: a well-stocked library table
with good paper, good typography, and room to breathe.

We build for the developer who reads their own code a year later and wants to
remember why. For the maintainer who shares a session with a teammate and wants
it to feel like a letter, not a log file. For the curious visitor who arrives
via a shared link and stays because the page felt like it was written by a
person.

The aesthetic is **Warm, Editorial, and Quietly Technical.** We use serif
typography for long-form reading, humanist sans for UI, and monospace only
where it genuinely belongs (code, commands, data). We honor density and
structure — this is still a developer tool — but we trade sharp edges for soft
ones, pure black for warm charcoal, and `[STATUS]` brackets for natural
language with intentional icons.

**Think:** Anthropic's Claude.ai conversation surfaces. iA Writer. A well-
designed technical book. A senior engineer's README. A field journal kept by
someone who cares about both accuracy and beauty.

**Not:** Cursor's marketing site. GitHub's Primer. Vercel's dashboard. Any tool
that feels like it was designed by someone who thinks "developer" and
"austere" are synonyms.

---

## 2. Colors

The palette is rooted in a warm cream base — the color of aged paper under
lamp light. High legibility without harshness. Functional but never cold.

### Color Tokens

```
BASE
────
Surface           #FAF9F6   Warm cream. The page. Never pure white.
Surface raised    #F5F2EC   Slightly darker cream for cards, callouts.
Surface sunk      #EDE9DF   Inputs, code blocks, deeper nesting.
Surface overlay   #FFFFFF   Modal/overlay background (with warm border).

TEXT
────
Ink primary       #1F1F1C   Warm near-black. The body.
Ink secondary     #5D5A54   Muted warm gray. Metadata, captions.
Ink tertiary      #8B8680   Softer gray. Placeholder, disabled.
Ink inverse       #FAF9F6   On dark buttons.

ACCENT
──────
Amber primary     #C15F3C   Warm terracotta. Primary actions, links, active.
Amber hover       #A84E2E   Darker on hover.
Amber tint        #F4E6D9   Subtle fill for selected/hover states.

STATUS
──────
Sage success      #4A7C59   Warm green for success. Not neon.
Rust error        #B54843   Warm red for errors. Not alarm.
Honey warning     #C69333   Warm amber for warnings.
Slate info        #5D6B78   Cool gray-blue for info. Used sparingly.

BORDERS
───────
Border subtle     #E5E1D7   Warm beige. Default container borders.
Border default    #D4CFC1   Stronger for inputs, buttons.
Border active     #C15F3C   Amber primary. Focus, selected.
```

### The "Tonal Lift" Rule for Sectioning

Sections are defined by **tonal shifts**, not lines. Use the surface hierarchy:

- Page uses `surface` (#FAF9F6)
- Major content block uses `surface raised` (#F5F2EC)
- Interactive card or code block uses `surface sunk` (#EDE9DF)
- Modal floats on `surface overlay` (#FFFFFF) with a warm border

Avoid decorative 1px lines to separate sections. Let the color do the work.
Exception: **vertical timeline connectors** in event lists (see Components)
are explicit lines because they carry meaning — they show sequence.

### Surface Hierarchy & Nesting

Think of the UI as a stack of warm paper sheets, each slightly cooler than the
one below. The hierarchy is intentionally shallow — no more than 3 levels
deep:

```
LEVEL 0 (Page background)         surface         #FAF9F6
LEVEL 1 (Content block)           surface raised  #F5F2EC
LEVEL 2 (Card on block)           surface sunk    #EDE9DF
LEVEL 3 (Modal/floating)          surface overlay #FFFFFF
```

Going deeper than level 3 means you have a layout problem, not a color
problem.

### The Grid Texture (Subtle Atmosphere)

Background pages may use a **very subtle grid texture**: 1px dots or lines at
`#E5E1D7` with `opacity: 0.15`, 32px spacing. Invisible unless you look
directly at it. Provides a hint of structure, like graph paper on a desk.

```css
background-image:
  radial-gradient(circle, #E5E1D7 1px, transparent 1px);
background-size: 32px 32px;
opacity: 0.15;
```

Used only on the landing page, public profile hero, and shared conversation
public view. Never on dense dashboard pages where it would compete with data.

### Signature Warm Glow

For the one moment where we want light and warmth — the hero of the landing
page and the public profile — use a soft amber radial gradient behind the
content:

```css
background:
  radial-gradient(
    ellipse at top,
    rgba(193, 95, 60, 0.08) 0%,
    transparent 60%
  );
```

Barely visible. Suggests sunlight on paper. Never used as a button or card
background — only as atmosphere.

---

## 3. Typography

We use three typefaces, each with a specific job. The hierarchy comes from
**serif-for-reading, sans-for-UI, mono-for-code**. No uppercase SCREAMING
labels. No all-caps section headers. Typography is editorial, not ceremonial.

### Font Families

```
Headline / editorial     Source Serif 4        A warm, open serif.
                                                 Used for page titles,
                                                 article headings, pull
                                                 quotes.

Body / UI                Inter                  Humanist sans-serif.
                                                 Used for body text,
                                                 buttons, navigation,
                                                 form fields.

Code / technical         JetBrains Mono         Monospace. Used only for
                                                 actual code, terminal
                                                 output, commands, file
                                                 paths, and data tables.
```

All three are self-hosted for performance and privacy. Fallbacks use
system defaults in the same family.

### Type Scale

Numbers based on a 14px base body size with a 1.25 modular scale.

```
TOKEN         SIZE     LINE     WEIGHT   FAMILY       USE
─────         ────     ────     ──────   ──────       ───
display       48/56    1.15     500      Serif        Landing hero, profile hero
title-1       32/40    1.25     500      Serif        Page titles (/home, etc.)
title-2       24/32    1.3      500      Serif        Section headings
title-3       20/28    1.4      600      Sans         Subsections, card titles
title-4       16/24    1.5      600      Sans         Small headings, labels
body-lg       16/26    1.625    400      Sans         Long-form reading
body          14/22    1.6      400      Sans         Default body, UI text
body-sm       13/20    1.55     400      Sans         Secondary text
caption       12/18    1.5      400      Sans         Captions, metadata
micro         11/16    1.45     500      Sans         Chips, timestamps, small meta
code          14/22    1.6      400      Mono         Inline code, code blocks
code-sm       12/20    1.6      400      Mono         Dense code, inline
```

### Type Rules

1. **Page titles use the serif.** A page title is a statement. Serif gives it
   weight without shouting.

2. **Section headers use sentence case.** "Recent sessions", not "RECENT
   SESSIONS". All-caps is reserved for small labels (chip badges, micro text
   where needed for scanning).

3. **Body uses Inter at 14-16px.** Long-form content (conversation detail,
   landing page copy) uses 16px for comfort. Dense UI (tables, feeds) uses
   14px.

4. **Monospace is earned.** Only used when the content is literally code,
   data, or a command. Don't use mono for labels or metadata just because
   "it's a developer tool."

5. **Numbers use tabular figures** via `font-variant-numeric: tabular-nums`
   so columns align cleanly.

6. **Italic is allowed** — it's a serif, emphasis is part of the reading
   experience. Use sparingly for quoted text and deliberate emphasis.

7. **No letter-spacing tricks.** Don't stretch tiny labels with `letter-spacing:
   0.15em` to make them feel "editorial." The type does that on its own.

### Voice Through Type

The typographic choices communicate voice:

- Serif page titles → "this was written carefully"
- Sans body → "this is honest, direct, readable"
- Monospace in the right places → "this is technical when it needs to be"

This is the opposite of brutalism's "everything is a terminal." The Archive
says: technical where it matters, humane everywhere else.

---

## 4. Elevation & Depth

### The Layering Principle

Depth comes from **tonal lift + gentle shadows + warm borders**, never from
glossy drop shadows.

A card sitting on a content block has:
1. A slightly different surface color (one level sunk)
2. A 1px warm border
3. An optional very subtle shadow (see below)

The shadow is never the primary depth cue. If you removed the shadow, the
card would still read as lifted because of the border and color shift.

### Warm Shadow Tokens

```
shadow-subtle    0 1px 2px 0 rgba(31, 31, 28, 0.04)
shadow-default   0 2px 6px -1px rgba(31, 31, 28, 0.06),
                 0 1px 2px 0 rgba(31, 31, 28, 0.04)
shadow-raised    0 8px 20px -4px rgba(31, 31, 28, 0.08),
                 0 2px 4px -1px rgba(31, 31, 28, 0.05)
shadow-overlay   0 24px 48px -8px rgba(31, 31, 28, 0.15),
                 0 4px 8px -2px rgba(31, 31, 28, 0.08)
```

Notice these shadows are **tinted with warm ink** (`#1F1F1C`), not pure
black. They feel like paper on paper, not glass on glass.

### Borders

Borders are **soft and warm**, never 1px sharp black lines.

```
Default card border     1px solid #E5E1D7 (border-subtle)
Default input border    1px solid #D4CFC1 (border-default)
Hover/focus border      1.5px solid #C15F3C (border-active)
Error border            1.5px solid #B54843 (rust-error)
```

The thickness going to 1.5px on active state adds emphasis without
looking aggressive. At 1px active state, it can feel timid.

### Corner Radius (Yes, We Have Corner Radius)

This is the biggest break from Binary Architect. Sharp 0px corners signal
coldness. The Archive uses **consistent, thoughtful radii**:

```
radius-sm    4px     Chips, tags, small buttons
radius-md    8px     Cards, inputs, default buttons
radius-lg    12px    Modals, large cards, containers
radius-pill  999px   Status pills, profile avatars, filter chips
```

**Rules:**
- Every card has `radius-md` (8px). Warm but not bubbly.
- Status pills and file reference chips are fully rounded (`radius-pill`).
- Avatars are circles, not squares.
- Code blocks use `radius-md` (8px) to feel like a block of content, not
  a hard insertion.
- Modals use `radius-lg` (12px) — they're the largest corner in the system.

No `border-radius: 0` anywhere in this system. If you want sharp, use Binary
Architect.

---

## 5. Components

### Buttons

Four variants. All with soft 8px corners, warm colors, comfortable padding.

```
PRIMARY
┌──────────────────┐
│  Create token    │     Amber fill (#C15F3C)
└──────────────────┘     Cream text (#FAF9F6)
                         Hover: darker amber (#A84E2E)
                         Corners: 8px

SECONDARY
┌──────────────────┐
│  Cancel          │     Transparent fill
└──────────────────┘     Warm border (#D4CFC1)
                         Ink primary text
                         Hover: surface-sunk fill
                         Corners: 8px

GHOST
    Cancel                 No border, no fill
    ──────                 Ink secondary text
                         Hover: ink primary text
                         Optional underline on hover

DESTRUCTIVE
┌──────────────────┐
│  Delete account  │     Rust fill (#B54843)
└──────────────────┘     Cream text
                         Hover: darker rust
                         Only used in confirmation
                         dialogs, never in primary nav
```

**Specs:**
- Height: 36px default / 44px large / 28px small
- Horizontal padding: 20px default / 16px small
- Font: Inter, 14px, 500 weight
- Transition: 120ms ease-out on background + border (the rare allowed animation)
- Focus: 3px warm amber ring (`#C15F3C` at 30% opacity) on `:focus-visible`

**Labels use sentence case.** "Create token" not "CREATE TOKEN". Natural,
calm, confident. No brackets. No uppercase.

### Inputs

```
┌──────────────────────────────────────┐
│  Search sessions...                  │
└──────────────────────────────────────┘
```

- Background: `surface sunk` (#EDE9DF)
- Border: 1px `border-default` (#D4CFC1)
- Corners: 8px
- Height: 40px
- Padding: 0 16px
- Font: Inter, 14px, ink primary
- Placeholder: ink tertiary (#8B8680)
- Focus: border becomes `border-active`, adds 3px amber ring

**Prefix icons** are allowed — a magnifying glass in a search field is fine.
Icons are 16px, stroke 1.5px, ink secondary color.

### Cards

```
┌──────────────────────────────────────┐
│                                      │
│  Card title                          │
│  Subtitle in secondary ink           │
│                                      │
│  Body content sits here with         │
│  comfortable breathing room.         │
│                                      │
└──────────────────────────────────────┘
```

- Background: `surface raised` (#F5F2EC) on base page, or `surface` on raised
  page
- Border: 1px `border-subtle` (#E5E1D7)
- Corners: 8px (`radius-md`)
- Padding: 20px default, 24px for reading-heavy cards
- Shadow: `shadow-subtle` by default, `shadow-default` on hover for
  interactive cards

**Interactive cards** (clickable) get a subtle hover lift:
- Shadow becomes `shadow-default`
- Border color shifts to `border-default` (slightly darker warm)
- 120ms ease-out transition

No scale transform. The lift is enough.

### Timeline (The Signature Component)

**This is the component Claude Code web centers around.** A vertical timeline
with icon nodes and text. Used for activity feeds, session event lists, and
conversation detail activity groups.

```
   ○  Read a file
   │     src/api/auth.ts
   │
   ✎  Edited 2 files
   │     src/api/auth.ts, src/lib/session.ts
   │
   $  Ran pnpm test
   │     All 47 tests passed
   │
   ✓  Done
```

**Specs:**
- Icon column: 32px wide, icons centered (16px, stroke 1.5px)
- Connector line: 1px solid `border-subtle`, positioned through the icon
  centers, runs from halfway-above-first to halfway-below-last
- Content column: flows naturally, 16px left margin from icon column
- Vertical gap between items: 16px
- Each item's title: body-sm (13px) weight 500, ink primary
- Each item's subtitle: micro (11px) weight 400, ink secondary
- File references in subtitles: rendered as inline chips (see below)

**Icon vocabulary:**

```
○    read          (empty circle, neutral)
✎    edit          (pencil)
✚    create        (plus)
$    bash          (dollar prompt)
▸    tool call     (triangle, for generic tool runs)
?    question      (for AskUserQuestion)
!    callout       (for warnings / hook blocks)
⁘    subagent      (three-dot vertical, signals branching)
✓    done          (checkmark)
◆    milestone     (diamond, for phase boundaries)
✕    error         (x, for failures)
```

Icons are drawn at 16px with 1.5px stroke weight. They feel like hand-
sketched glyphs, not heavy UI chrome.

**Collapsed state:**
When an activity group is collapsed, it shows a summary line with a right
chevron:

```
   ▸  Explored codebase       12 tool runs    ›
```

Click to expand. The expansion reveals the full timeline of sub-items inside,
indented by the connector.

### File Reference Chips

```
 ┌─────────────────┐
 │  design-brief.md │
 └─────────────────┘
```

Inline pill for file paths, package names, repository names.

- Background: `amber tint` (#F4E6D9)
- Text color: `amber primary` (#C15F3C), but at full opacity so it reads
  as darker warm brown
- Font: JetBrains Mono, 12px (code-sm)
- Padding: 2px 8px
- Corners: fully rounded (pill shape)
- Cursor: pointer (file chips link to a preview or open the file)
- Hover: background darkens slightly

**Used for:**
- File paths in activity subtitles
- Package names in session summaries
- Repository names in session rows (but only in mono contexts)

### Status Pills

```
  • Private         (gray dot, ink secondary text)
  • Unlisted        (amber dot, ink primary text)
  • Public          (sage dot, ink primary text)
```

- Background: transparent
- Dot: 6px circle in the appropriate color
- Text: 12px Inter weight 500, sentence case
- Gap between dot and text: 6px
- No border — the dot is the signal

### Tables

```
Title                    Repo              Type       Duration   Cost
───────────────────────────────────────────────────────────────────────
Add user profile system  personal/howicc   building    7.6h      $2.14
Fix auth middleware      really-app        debugging   1.2h      $0.45
Explore caching          really-app        exploring   0.4h      $0.12
```

- Header: body-sm (13px), weight 500, ink secondary, lowercase with `::first-letter { text-transform: uppercase }` — basically sentence case
- Header separator: 1px solid `border-subtle` below the row
- Row height: 52px (generous for reading)
- Row padding: 12px vertical, 16px horizontal
- Row separator: **none** — rely on generous row height for scanning
- Hover: background becomes `surface raised` with 120ms transition
- Numbers right-aligned, tabular figures
- Monospace allowed for repo names and file paths inside cells

Tables feel like a reference book's index, not a spreadsheet.

### Dividers

Used sparingly. Never as the primary structure (that's the tonal lift rule).

```
──────────────────────────────────────
```

- 1px solid `border-subtle`
- Full container width
- 32px vertical margin
- Never colored, never dashed, never decorative

**With label:**

```
───────── Recent activity ─────────
```

Used for section breaks in long-form content. Label uses micro (11px) size,
ink secondary color, sentence case, 12px horizontal padding.

### Modals

```
                ┌──────────────────────────────┐
                │                              │
                │  Confirm deletion            │
                │                              │
                │  This will permanently       │
                │  delete your account and     │
                │  all synced sessions.        │
                │                              │
                │  Type DELETE to confirm:     │
                │  ┌────────────────────────┐  │
                │  │                        │  │
                │  └────────────────────────┘  │
                │                              │
                │     [Cancel]  [Delete]       │
                └──────────────────────────────┘
```

- Background: `surface overlay` (#FFFFFF)
- Border: 1px `border-subtle`
- Corners: 12px (`radius-lg`)
- Shadow: `shadow-overlay`
- Padding: 32px
- Max-width: 480px
- Backdrop: ink primary at 40% opacity, no blur
- Open animation: 150ms ease-out fade + 8px slide up
- Close: ESC or backdrop click or cancel button
- Focus trap inside modal

### Loading

Three patterns depending on context:

**1. Inline spinner** for buttons and small async operations:

```
  ┌──────────────────┐
  │  ◐ Saving...     │
  └──────────────────┘
```

A quarter-circle that rotates. 14px, 1.5px stroke, amber color. 0.8s rotation,
linear.

**2. Skeleton rows** for lists:

```
  ───────────────────────────
  ──────────
  ────────────────
```

- Background: `border-subtle` (#E5E1D7)
- Corners: 4px
- Subtle shimmer animation: 1.5s ease-in-out, moves a lighter band
  left-to-right
- Realistic shapes matching the real content

**3. Progress bar** for measurable operations (uploads):

```
  ━━━━━━━━━━━━━━━━━━━━━━━━━  68%
```

- Track: `border-subtle` (#E5E1D7)
- Fill: `amber primary` (#C15F3C)
- Height: 4px
- Corners: fully rounded
- Label: body-sm ink secondary, right-aligned

No blinking cursor. No ASCII spinners. The Archive is friendly, not retro.

### Empty States

Empty states are **welcoming and instructional**. They have a serif title,
sans subtitle, and a next-step action.

```
┌──────────────────────────────────────┐
│                                      │
│     Nothing synced yet                │     ← serif title-2
│                                      │
│     Run howicc sync to bring your     │     ← sans body
│     Claude Code sessions here.        │
│                                      │
│     ┌──────────────────────────┐     │
│     │  npm i -g @howicc/cli    │     │     ← code block
│     │  howicc login            │     │
│     │  howicc sync             │     │
│     └──────────────────────────┘     │
│                                      │
│     [  CLI documentation  ]           │     ← ghost button
│                                      │
└──────────────────────────────────────┘
```

- Centered vertically in the container
- 80px vertical padding
- No illustrations. No "oops!" copy. No cute characters.
- Specific, actionable next steps

### Toasts

```
  ┌────────────────────────────────────┐
  │  ✓  Token copied to clipboard       │
  └────────────────────────────────────┘
```

- Background: `surface overlay` (#FFFFFF)
- Border: 1px `border-subtle` with a 4px left border in the status color
- Corners: 8px
- Shadow: `shadow-raised`
- Padding: 12px 20px
- Position: bottom-right, 24px margin
- Duration: 4 seconds
- Open animation: 200ms ease-out slide up + fade
- Icon: 16px, status color
- Text: body-sm, ink primary

Status colors:
- Success: `sage` left border + `sage` icon
- Error: `rust` left border + `rust` icon
- Info: `slate` left border + `slate` icon

### Tooltips

```
  ┌──────────────────────┐
  │  Created 2h ago      │
  └──────────────────────┘
```

- Background: `ink primary` (#1F1F1C)
- Text: `ink inverse` (#FAF9F6)
- Corners: 6px
- Padding: 6px 10px
- Font: micro (11px) weight 500
- Shadow: `shadow-default`
- Position: above element, 8px gap
- No arrow pointer

The tooltip is the one place we invert the palette — dark warm on light text.
It feels like a physical label tag attached to the element.

### Navigation Bar

```
┌──────────────────────────────────────────────────────────────┐
│  HowiCC          Home   Sessions   Insights       [avatar]  │
└──────────────────────────────────────────────────────────────┘
```

- Background: `surface` (#FAF9F6) with subtle bottom border (`border-subtle`)
- Height: 64px (generous)
- Logo: serif weight 500, 18px, ink primary
- Nav links: body (14px), ink secondary by default, ink primary on hover,
  amber primary when active
- Active state: amber primary text + 2px amber underline 4px below the text
- Gap between links: 32px
- Avatar: 32px circle on the right

No dropdown arrows. No icons on nav items. Text only.

### Avatar

```
     ●●●●●
   ●       ●
  ●   AO    ●
   ●       ●
     ●●●●●
```

- Default: 32px circle with initials in Inter 500 weight
- Background: deterministic warm color per user (hash the username to a set
  of 6 warm tones: amber, sage, slate, rust-tinted, honey, deep-plum)
- Text: `ink inverse` (#FAF9F6) or `ink primary` depending on background
  lightness
- Large: 64px (profile cards, comment avatars)
- Hero: 128px (public profile hero)

Optional **live dot** (6px sage circle) overlaid bottom-right indicates
"synced in the last 24h". Positioned absolutely with a 2px cream ring to
separate it from the avatar edge.

### Conversation Blocks

The conversation detail page uses a timeline structure (see Timeline above)
with specialized variants for each RenderBlock type:

**Message block (user):**

```
      ┌─────────────────────────────────────┐
  AO  │                                     │
      │  I've reviewed the revamp docs...   │
      │                                     │
      └─────────────────────────────────────┘
```

- 32px avatar, 16px gap
- Content in a card: `surface raised` bg, 8px corners, 16px padding
- Font: body-lg (16px) Inter, generous line-height

**Message block (assistant):**

```
      Assistant
      ────────────────────────────────────
      The plan is approved. A few tactical
      observations before you start...
```

- No avatar (or Claude-style small mark)
- No card — just inline content with a subtle top separator
- Font: body-lg (16px) Inter
- Markdown fully rendered with serif subheadings inside

**Question block:**

```
   ?  Question
      "Should I start with Phase 1?"
      ─────────────────────────────
      ●  Phase 1 and 2 together  ← selected
      ○  Phase 1 only
      ○  Show full plan first
      ─────────────────────────────
      Outcome: answered
```

- `surface sunk` background
- 8px corners
- 20px padding
- Amber border-left 3px to signal this is a special block

---

## 6. Do's and Don'ts

### Do:

- **Do** use warm cream backgrounds that feel like paper, never cold white
  or pure black.
- **Do** use serif for page titles and pull quotes — it communicates
  craftsmanship.
- **Do** use natural language everywhere: "Created a file" not "CREATE_FILE"
  or `[CREATED]`.
- **Do** use generous line-height (1.55-1.625) for comfortable reading.
- **Do** use the timeline component for any sequence of events.
- **Do** align content to a 4px baseline grid.
- **Do** let tonal shifts (not lines) define sections.
- **Do** use monospace only for actual code, commands, and data.
- **Do** use gentle shadows tinted with warm ink — never pure black.
- **Do** round corners consistently (4 / 8 / 12 / pill).
- **Do** use 120-200ms ease-out transitions on hover and state changes —
  subtle animation is humane.
- **Do** write error messages like sentences: "We couldn't load your sessions.
  Try again?" — not `ERR: FETCH_FAILED`.
- **Do** respect `prefers-reduced-motion` absolutely.

### Don't:

- **Don't** use pure black (`#000`) or pure white (`#FFF`) anywhere. Both
  feel cold and synthetic. Use warm near-black and warm cream.
- **Don't** use 0px border radius. Sharp corners signal coldness. Every
  container has rounded corners.
- **Don't** use UPPERCASE for button labels or section headers. Sentence
  case is warmer and more legible.
- **Don't** use `[STATUS]` brackets or `ERR:` prefixes. That's the language
  of the other design system.
- **Don't** use monospace for UI chrome (buttons, navigation, labels). Mono
  is for content, not interface.
- **Don't** use glowing neon accents. The amber is warm and saturated but
  never radioactive.
- **Don't** animate for decoration. Animate only to communicate state change
  (loading, open, confirmation).
- **Don't** use drop shadows that feel like glossy SaaS elevation. Keep
  shadows warm, subtle, paper-like.
- **Don't** write copy like a robot. The voice is "careful friend explaining"
  not "system reporting status".
- **Don't** use icons where a word would do better. But also don't avoid
  icons when they carry meaning (timeline nodes, status indicators).
- **Don't** make everything dense. Reading-heavy pages (conversation detail,
  landing) deserve breathing room. Dashboard pages can be tighter.
- **Don't** use the subtle grid background on dense pages — it competes
  with data.

### Voice and Tone Don'ts

These are specifically different from Binary Architect:

```
  BINARY ARCHITECT              THE ARCHIVE
  ────────────────              ───────────
  ERR: Connection refused        We couldn't connect. Try again?
  OK  Saved.                     Saved.
  CREATE TOKEN                   Create token
  [private] [public]             Private · Public
  $ howicc sync                  howicc sync
  ACCOUNT  TOKENS  PROFILE       Account  ·  Tokens  ·  Profile
  ------- RECENT -------         Recent activity
  Loading._                       Loading your sessions…
```

Neither is wrong. They communicate different personalities. The Archive's
voice is **quietly confident, unapologetic about being a tool, but warm to
the user.**

---

## Accessibility Note

The warm cream base makes contrast work harder than a pure black-on-white or
white-on-black scheme would. Verify:

- **Body text** (`ink primary` #1F1F1C on `surface` #FAF9F6) — ratio 15.8:1.
  Passes AAA for all text sizes.
- **Secondary text** (`ink secondary` #5D5A54 on `surface`) — ratio 6.2:1.
  Passes AA for normal text, AAA for large.
- **Amber primary text** (`amber` #C15F3C on `surface`) — ratio 4.6:1. Passes
  AA for normal text. Use amber for links and active states, but not for body
  paragraphs.
- **Tertiary text** (`ink tertiary` #8B8680 on `surface`) — ratio 3.8:1.
  **Fails AA for normal text.** Only use for placeholder, disabled states,
  and small metadata where WCAG allows 3:1.

**Focus indicators** are 3px amber rings (`#C15F3C` at 30% opacity outside
the element, solid amber border on the element itself). Always visible for
keyboard users via `:focus-visible`.

**Reduced motion:** All transitions (120-200ms ease-out, skeleton shimmer,
modal open, spinner rotation) are disabled under `prefers-reduced-motion:
reduce`. Only the essential state change remains — elements appear and
disappear instantly, without movement.

**Color is never the only signal.** Status pills use both a colored dot
and the status word. Error borders come with error text below the field.
Active nav items have both color and underline.

---

## Companion Documents

- [17-web-app-pages-and-screens.md](17-web-app-pages-and-screens.md) — page wireframes
- [18-data-and-api-per-page.md](18-data-and-api-per-page.md) — data and API reference
- [19-developer-brutalism-prd.md](19-developer-brutalism-prd.md) — the dark alternative
- [15-jtbd-ux-flows-and-user-journey.md](15-jtbd-ux-flows-and-user-journey.md) — user journeys

---

## The Archive vs Binary Architect

These are two valid answers to the same product question. Pick one and commit.
Don't mix them.

| Question | The Archive | Binary Architect |
|----------|-------------|------------------|
| Base color | Warm cream (#FAF9F6) | Pure black (#000) |
| Text color | Warm charcoal (#1F1F1C) | Off-white (#F3F3F3) |
| Primary font | Source Serif 4 + Inter | JetBrains Mono only |
| Corner radius | 4/8/12/pill | 0 everywhere |
| Shadows | Soft warm paper shadows | None |
| Animation | 120-200ms ease-out | Instant + blinking cursor |
| Button labels | Sentence case | UPPERCASE |
| Section labels | "Recent activity" | "RECENT" |
| Errors | "We couldn't connect. Try again?" | "ERR: Connection refused." |
| Voice | Quietly confident friend | CLI status reporter |
| Reading heavy? | Yes, ideal for conversation detail | Better for dashboards |
| Sharing heavy? | Yes, public pages feel editorial | Niche aesthetic signal |
| Developer identity? | "Thoughtful maker" | "Terminal native" |

**Recommendation:** The Archive for the web app. Binary Architect would be
a beautiful niche statement, but The Archive serves a wider audience and
matches HowiCC's core value prop: preserving sessions as durable, readable
artifacts. The conversation detail page — the product's core — is a
reading experience, and reading experiences deserve warm paper, serif
headings, and generous line-height.

The CLI can still use the Binary Architect aesthetic in its terminal output.
That's where it belongs.
