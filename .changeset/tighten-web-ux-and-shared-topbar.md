---
'@howicc/web': patch
---

Tighten the web app under one voice and one top bar. Extract a shared `AppTopBar` (home, sessions, insights, settings all render the same nav and warm-paper background), a shared `SyncFirstSession` empty state (replaces three divergent CLI dumps), and a styled `AccessDenied` page for repo admin 403s. `AccountAvatar` now renders the GitHub image via a native `<img>` so it paints in SSR. User menu and mobile nav wrap `DropdownMenuLabel` in `DropdownMenuGroup` to fix a base-ui `MenuGroupRootContext` error. Copy pass across every page strips internal vocabulary (Wave A–D, revamp doc, `POST /profile/recompute`, `User id`, `Session expires`, `canonical sessions`), collapses container widths to two scales, renders model IDs as friendly labels, lowercases `/r/:owner/:name` with a 301 redirect, and swaps emoji empty states for lucide icons.
