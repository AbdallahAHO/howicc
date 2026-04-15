# Team Access Control and GitHub Integration

> **Related:** The repo page and admin moderation UI is specified as
> wireframes in [doc 17 Page 8 & 9](17-web-app-pages-and-screens.md).
> Visual system is [The Archive](20-design-md-the-archive.md).

## Problem Statement

The current repo model groups sessions by `full_name` — anyone who syncs sessions
from `axetay/really-app` gets linked to the same repo row. There is no verification
that the person actually has access to that GitHub repository, no distinction between
a maintainer and a random fork user, and no way for a repo admin to moderate what
appears on the repo page.

This creates three problems:
1. **Strangers can pollute repo stats** — someone outside the org syncs from a fork
   or same-named repo and their data appears in the aggregate.
2. **Nobody can moderate the repo page** — no admin role, no way to hide sensitive
   sessions or control what's shown publicly.
3. **No centralized team view** — team members can't see all AI usage on their repo
   in one place with proper access gating.

## Target Users

```
  Contributor  ── verified GitHub write access to the repo
  Admin        ── GitHub admin or maintainer role on the repo
  Explorer     ── no GitHub access, or read-only public repo access
  Org Member   ── belongs to the GitHub org that owns the repo
```

## Team Jobs To Be Done

### J5: Gate Repo Access By Real Permissions
**When** someone views a repo page on HowiCC,
**I want** their access to be verified against GitHub in real-time,
**So that** only people who actually have access to the repo see the team view.

### J6: Moderate The Repo Page
**When** a team member's public session contains something inappropriate or
misleading on the repo page,
**I want** to hide it from the repo view as a repo admin,
**So that** the repo's public presence stays useful and appropriate.

### J7: See My Team's AI Usage In One Place
**When** our team uses Claude Code on the same repo,
**I want** to see everyone's aggregate AI usage (tools, languages, costs, patterns),
**So that** I can understand how we collectively use AI on this codebase.

### J8: Protect Private Repo Data
**When** our repo is private on GitHub,
**I want** HowiCC to treat it as private too — no leaks, no aggregate stats visible
to non-members,
**So that** our internal work patterns aren't exposed.

### J9: Understand Contributor Activity On Public Repos
**When** people contribute to our public open source repo using AI,
**I want** to see their sessions classified by contribution type
(committer, PR author, explorer),
**So that** I can understand the AI-assisted contribution landscape.

---

## Design

### GitHub Permission Verification

Users authenticate via GitHub OAuth with `repo` scope at login time. This gives
HowiCC the ability to call GitHub's repository API to check the user's permission
level on any repo.

**When it happens:** On every repo page view, with a short per-user+repo cache
(about 5 minutes) so the permission checks stay fresh without hammering the
GitHub API.

**API call:**
```
GET https://api.github.com/repos/{owner}/{name}
Authorization: Bearer {user's GitHub OAuth token}
```

**Response includes:**
```json
{
  "permissions": {
    "admin": true,
    "maintain": true,
    "push": true,
    "pull": true
  },
  "private": true,
  "fork": false
}
```

If the request returns 404 or 403, the user has no access.

### Role Mapping

```
  GitHub Permission          HowiCC Role        Powers
  ──────────────────         ──────────         ──────
  admin: true                Repo Admin         See all member sessions
                                                Hide conversations from repo page
                                                Set repo-level visibility
                                                See contributor list

  maintain: true             Repo Admin         Same as admin
  (admin: false)

  push: true                 Contributor        See aggregate stats
  (maintain: false)                             See their own sessions
                                                Cannot moderate

  pull: true only            Reader             See aggregate stats (if repo
  (push: false)                                 visibility allows)
                                                See their own sessions only

  404 / 403                  No Access          Cannot view repo page at all
                                                (private repos)
                                                OR: classified as Explorer
                                                (public repos)
```

### Private vs Public Repo Behavior

#### Private Repos

```
┌─────────────────────────────────────────────────────────────┐
│                     PRIVATE REPO                             │
│                                                              │
│  GitHub says user has NO access (404/403):                   │
│  → Silently excluded from repo stats                        │
│  → Their sessions stored on personal profile only           │
│  → Repo page returns 404 to them                            │
│  → If they sync sessions from this repo, sessions are       │
│    stored WITHOUT repository_id linkage                     │
│  → Admin can approve pending requests (future)              │
│                                                              │
│  GitHub says user HAS access:                                │
│  → Verify role (admin/maintain/push/pull)                   │
│  → Show repo page based on role                              │
│  → Their synced sessions link to the repo                    │
│  → Stats include their data in aggregate                     │
└─────────────────────────────────────────────────────────────┘
```

#### Public Repos

```
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC REPO                              │
│                                                              │
│  GitHub says user has push/admin/maintain access:            │
│  → Full member view (same as private repo members)          │
│                                                              │
│  GitHub says user has pull-only or no explicit access:       │
│  → Classify by contribution history (future, v2):           │
│    - Committer:  has commits on default branch               │
│    - PR Author:  has merged or open PRs                      │
│    - Explorer:   no commit/PR history, just browsing         │
│                                                              │
│  MVP (v1): public repo page shows aggregate stats to all    │
│  authenticated users. Admin/maintainer can hide sessions.    │
│  Contributor tiers deferred to v2.                           │
└─────────────────────────────────────────────────────────────┘
```

### Visibility Model: Ceiling and Floor

```
  Repo admin sets the CEILING (maximum exposure):

    Repo visibility: private
    → No conversations from this repo visible to non-members,
      even if the conversation owner set theirs to "public"
    → Conversation is still accessible via direct link if
      the owner explicitly shared it (the ceiling doesn't
      block direct-link access, only repo page inclusion)

    Repo visibility: members
    → Aggregate stats visible to verified GitHub members only
    → Published conversations visible on repo page to members

    Repo visibility: public
    → Aggregate stats visible to everyone
    → Published conversations visible on repo page to everyone

  Conversation owner sets the FLOOR (minimum privacy):

    Conversation visibility: private
    → Never appears on repo page, regardless of repo visibility
    → Only visible to the owner

    Conversation visibility: unlisted
    → Accessible via direct link to anyone
    → Appears on repo page only if repo visibility allows

    Conversation visibility: public
    → Accessible via direct link to anyone
    → Appears on repo page only if repo visibility allows
    → Appears in search (future)


  THE RULE:
    visible_on_repo_page = (
      conversation.visibility >= repo.visibility
      AND conversation NOT hidden by admin
      AND viewer has GitHub access to repo
    )

  ADMIN CAN:       restrict (hide from page, lower repo visibility)
  ADMIN CANNOT:    force-expose someone else's private session
  OWNER CAN:       restrict (make private, make unlisted)
  OWNER CANNOT:    bypass repo visibility ceiling on repo page
                   (but CAN still share via direct link)
```

### Admin Moderation Flow

```
  Admin visits repo page
       │
       ▼
  Sees all conversations (including ones they don't own)
       │
       ▼
  Clicks [...] on a conversation → "Hide from repo page"
       │
       ▼
  PATCH /repos/:owner/:name/conversations/:id/repo-visibility
  { hidden: true }
       │
       ▼
  Conversation no longer appears on repo page
  (still accessible via direct link if owner made it public/unlisted)
  (owner is NOT notified — this is non-destructive moderation)
```

### Data Model Changes

```sql
-- repositories table gains visibility
ALTER TABLE repositories ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
-- Values: 'private' | 'members' | 'public'

-- Track admin-hidden conversations (moderation)
CREATE TABLE repo_conversation_overrides (
  id              TEXT PRIMARY KEY,
  repository_id   TEXT NOT NULL REFERENCES repositories(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  hidden          INTEGER NOT NULL DEFAULT 0,   -- 1 = hidden from repo page
  hidden_by       TEXT,                          -- user_id of admin who hid it
  hidden_at       INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX repo_conv_overrides_repo_conv_idx
  ON repo_conversation_overrides(repository_id, conversation_id);
```

No GitHub-side data is stored persistently. Permissions are checked live
on every repo page view using the viewer's OAuth token.

---

## API Design

### Repo page (enhanced with GitHub verification)

```
GET /repos/:owner/:name

Headers:
  Authorization: Bearer <howicc-token>  (to identify the user)

Server-side:
  1. Resolve user from HowiCC token
  2. Look up user's GitHub OAuth token (stored during login)
  3. Call GitHub API: GET /repos/:owner/:name with GitHub token
  4. If 404/403 → return 403 "No access to this repository"
  5. Extract permissions.admin, permissions.maintain, permissions.push
  6. Map to HowiCC role
  7. Query D1 for repo stats, conversations, digests
  8. Apply visibility rules (ceiling/floor)
  9. Apply admin overrides (hidden conversations)
  10. Return filtered response with viewer's role

Response:
{
  repository: { fullName, provider, visibility },
  viewerRole: "admin" | "contributor" | "reader",
  stats: { sessionCount, totalDuration, contributors, ... },
  conversations: [ ... filtered by visibility rules ... ],
  contributors: [ ... member list ... ]
}
```

### Admin: hide conversation from repo page

```
PATCH /repos/:owner/:name/conversations/:id/repo-visibility

Headers:
  Authorization: Bearer <howicc-token>

Body:
  { hidden: true }

Server-side:
  1. Verify user is admin/maintainer via GitHub API
  2. If not → 403
  3. UPSERT repo_conversation_overrides with hidden=1
  4. Return 200
```

### Admin: set repo visibility

```
PATCH /repos/:owner/:name/visibility

Headers:
  Authorization: Bearer <howicc-token>

Body:
  { visibility: "members" }

Server-side:
  1. Verify user is admin/maintainer via GitHub API
  2. If not → 403
  3. UPDATE repositories SET visibility = :visibility
  4. Return 200
```

---

## Sequence: Team Member Views Repo Page

```
  Browser                    HowiCC API              GitHub API          D1
     │                          │                       │                │
     │  GET /repos/axetay/      │                       │                │
     │       really-app         │                       │                │
     │────────────────────────> │                       │                │
     │                          │                       │                │
     │                          │  GET /repos/axetay/   │                │
     │                          │       really-app      │                │
     │                          │  Authorization:       │                │
     │                          │   Bearer <gh-token>   │                │
     │                          │─────────────────────> │                │
     │                          │                       │                │
     │                          │  <── 200 {            │                │
     │                          │    permissions: {     │                │
     │                          │      admin: false,    │                │
     │                          │      push: true       │                │
     │                          │    },                 │                │
     │                          │    private: true      │                │
     │                          │  }                    │                │
     │                          │                       │                │
     │                          │  role = contributor                    │
     │                          │                                        │
     │                          │  SELECT conversations                  │
     │                          │  WHERE repository_id = :id             │
     │                          │  AND visibility IN ('public','unlisted')│
     │                          │  AND NOT hidden by admin               │
     │                          │──────────────────────────────────────> │
     │                          │                                        │
     │                          │  SELECT aggregate stats                │
     │                          │──────────────────────────────────────> │
     │                          │                                        │
     │  <── {                   │                                        │
     │    viewerRole: "contri   │                                        │
     │      butor",             │                                        │
     │    stats: {...},         │                                        │
     │    conversations: [...]  │                                        │
     │  }                       │                                        │
```

## Sequence: Non-Member Tries Private Repo

```
  Browser                    HowiCC API              GitHub API
     │                          │                       │
     │  GET /repos/axetay/      │                       │
     │       really-app         │                       │
     │────────────────────────> │                       │
     │                          │  GET /repos/axetay/   │
     │                          │       really-app      │
     │                          │  Authorization:       │
     │                          │   Bearer <gh-token>   │
     │                          │─────────────────────> │
     │                          │                       │
     │                          │  <── 404 Not Found    │
     │                          │                       │
     │  <── 403 {               │                       │
     │    error: "No access     │                       │
     │     to this repository"  │                       │
     │  }                       │                       │
```

---

## Storing The GitHub Token

The user's GitHub OAuth token is already available from the Better Auth login flow.
It's stored in the `accounts` table:

```
accounts
  ├── userId
  ├── providerId = "github"
  ├── accessToken          ← this is what we use
  └── refreshToken
```

When checking repo access:
1. Look up the user's account row where `providerId = 'github'`
2. Use `accessToken` to call `GET https://api.github.com/repos/:owner/:name`
3. If the token is expired/revoked, the GitHub call returns 401 → prompt re-auth

**OAuth scope requirement:** The GitHub OAuth app must request `repo` scope at
login time. This allows the token to access private repo metadata (including
the `permissions` object). Without `repo` scope, private repos return 404.

---

## MVP vs Future

### MVP (v1)

- Verify GitHub repo access on every repo page view
- Map admin/maintain → repo admin, push → contributor
- Admin can hide conversations from repo page
- Admin can set repo visibility (private/members/public)
- Ceiling/floor visibility model
- Private repos: 403 for non-members
- Public repos: show aggregate stats to all authenticated users

### v2: Contributor Tiers For Public Repos

- Classify public repo viewers by contribution type:
  - Committer: has commits on default branch (check via GitHub API)
  - PR Author: has merged/open PRs (check via GitHub API)
  - Explorer: no commit/PR history
- Show contributor tier on the repo page
- Different stat visibility per tier (admins decide)

### v2: Pending Approval Queue

- For private repos: non-members who sync sessions get a "pending" state
- Admin sees approval queue on repo settings page
- Approve → link their sessions to the repo
- Reject → sessions stay on personal profile only

### v3: GitHub App Integration

- Optional GitHub App installation for orgs
- Webhook-driven permission sync (always current, no API call on page view)
- Team sync: import org team structure
- Richer contribution analysis (commit history, PR reviews)

---

## Success Criteria

1. A team member visiting `howi.cc/r/axetay/really-app` sees aggregate AI usage
   only if they have GitHub push access to that repo
2. A non-member visiting the same URL for a private repo sees 403
3. A repo admin can hide a conversation from the repo page without affecting the
   owner's ability to share it via direct link
4. A repo admin can set the repo to "members only" or "public"
5. Session owners retain full control over their own conversation visibility
   (no one can force-expose a private session)
6. GitHub token expiry/revocation correctly blocks access on next page view

## Open Questions

1. **Rate limits:** GitHub API allows 5000 requests/hour per OAuth token.
   With check-on-every-view, a popular repo page could exhaust this quickly.
   Mitigation: short TTL cache (5 min) per user+repo pair. Still "always fresh"
   from UX perspective but avoids hammering GitHub.

2. **Token storage:** Better Auth stores the GitHub access token. We need to
   verify it's accessible from the API runtime and handle token refresh.

3. **Org-level pages:** Should there be an org-level view (`howi.cc/o/axetay`)
   showing all repos? Deferred — start with repo-level only.

4. **Fork handling:** A fork of `axetay/really-app` is a different repo on GitHub
   (`user/really-app`). Sessions from the fork link to the fork's `full_name`,
   not the upstream. This is correct behavior — forks are separate repos.

5. **Repo name changes:** If a repo is renamed on GitHub, old sessions still point
   to the old `full_name`. New syncs create a new repository row with the new name.
   Consider: a background job that checks if a stored repo URL redirects and
   merges the records. Deferred.
