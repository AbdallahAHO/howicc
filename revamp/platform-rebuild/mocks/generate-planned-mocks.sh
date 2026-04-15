#!/bin/bash
# Generate mock responses for endpoints from doc 18 that aren't implemented yet.
# Uses real data from local D1 to produce realistic shapes.

set -e

DIR="revamp/platform-rebuild/mocks/api-responses"
mkdir -p "$DIR"

# Dump raw data from D1 so the Python script can read it
cd apps/api
pnpm exec wrangler d1 export DB --local --config wrangler.jsonc --no-schema --output /tmp/howicc-dump.sql 2>&1 | tail -3
cd ../..

# Use Python to read D1 directly via sqlite3 (miniflare stores D1 as SQLite)
D1_FILE=$(find apps/api/.wrangler/state/v3/d1 -name "*.sqlite" | grep -v metadata | head -1)
echo "D1 file: $D1_FILE"

python3 <<PY
import sqlite3, json, os, datetime

db_path = "$D1_FILE"
out_dir = "$DIR"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

def q(sql, *args):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]

# Load everything we need
conversations = q("SELECT * FROM conversations")
revisions = q("SELECT * FROM conversation_revisions")
assets = q("SELECT * FROM conversation_assets")
digests = q("SELECT * FROM session_digests")
profiles = q("SELECT * FROM user_profiles")
users = q("SELECT id, email, name FROM users")

print(f"Loaded: {len(conversations)} conversations, {len(digests)} digests, {len(users)} users")

# Build lookup maps
digest_by_rev = {d['revision_id']: json.loads(d['digest_json']) for d in digests}
digest_row_by_rev = {d['revision_id']: d for d in digests}
rev_by_id = {r['id']: r for r in revisions}
conv_by_id = {c['id']: c for c in conversations}
user_by_id = {u['id']: u for u in users}

# Helper: format conversation for listing
def conv_summary(conv, digest=None, rev=None):
    return {
        "conversationId": conv['id'],
        "id": conv['id'],
        "slug": conv['slug'],
        "title": conv['title'],
        "visibility": conv['visibility'],
        "status": conv['status'],
        "repository": digest.get('repository') if digest else None,
        "gitBranch": digest.get('gitBranch') if digest else None,
        "sessionType": digest.get('sessionType') if digest else None,
        "messageCount": digest.get('messageCount', 0) if digest else 0,
        "toolRunCount": digest.get('toolRunCount', 0) if digest else 0,
        "durationMs": digest.get('durationMs', 0) if digest else 0,
        "estimatedCostUsd": digest.get('estimatedCostUsd') if digest else None,
        "updatedAt": datetime.datetime.fromtimestamp(conv['updated_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        "createdAt": datetime.datetime.fromtimestamp(conv['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
    }

# ---------------------------------------------------------------
# GET /profile/stats — lightweight stats header
# ---------------------------------------------------------------
profile_row = profiles[0] if profiles else None
profile_data = json.loads(profile_row['profile_json']) if profile_row else None
top_repos_counts = {}
top_repos = []

if profile_data:
    for d in digests:
        repo = d['repository']
        if repo:
            top_repos_counts[repo] = top_repos_counts.get(repo, 0) + 1
    top_repos = sorted(
        [{"fullName": k, "sessionCount": v} for k, v in top_repos_counts.items()],
        key=lambda x: -x['sessionCount']
    )[:3]

    stats = {
        "success": True,
        "sessionCount": profile_data['activity']['totalSessions'],
        "totalHours": round(profile_data['activity']['totalDurationMs'] / 3_600_000, 2),
        "totalCostUsd": round(profile_data['cost']['totalUsd'], 2),
        "currentStreak": profile_data['activity']['currentStreak'],
        "longestStreak": profile_data['activity']['longestStreak'],
        "activeDays": profile_data['activity']['activeDays'],
        "topRepos": top_repos,
    }
    with open(f"{out_dir}/GET__profile__stats.json", "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Wrote GET__profile__stats.json")

# ---------------------------------------------------------------
# GET /profile/activity — paginated session feed
# ---------------------------------------------------------------
# Get conversations sorted by updated_at DESC
sessions_feed = []
for conv in sorted(conversations, key=lambda c: -c['updated_at']):
    # Find the most recent revision
    convs_revs = [r for r in revisions if r['conversation_id'] == conv['id']]
    if not convs_revs:
        continue
    latest_rev = max(convs_revs, key=lambda r: r['created_at'])
    digest = digest_by_rev.get(latest_rev['id'])
    if not digest:
        continue
    sessions_feed.append(conv_summary(conv, digest, latest_rev))

activity_response = {
    "success": True,
    "sessions": sessions_feed,
    "total": len(sessions_feed),
    "totalDuration": sum(s['durationMs'] or 0 for s in sessions_feed),
    "totalCost": sum(s['estimatedCostUsd'] or 0 for s in sessions_feed),
    "page": 1,
    "pageSize": 20,
    "hasMore": False,
    "nextCursor": None,
}
with open(f"{out_dir}/GET__profile__activity.json", "w") as f:
    json.dump(activity_response, f, indent=2)
print(f"Wrote GET__profile__activity.json ({len(sessions_feed)} sessions)")

# ---------------------------------------------------------------
# GET /conversations/:id — full conversation metadata
# ---------------------------------------------------------------
for conv in conversations[:3]:
    convs_revs = [r for r in revisions if r['conversation_id'] == conv['id']]
    if not convs_revs:
        continue
    latest_rev = max(convs_revs, key=lambda r: r['created_at'])

    response = {
        "success": True,
        "id": conv['id'],
        "slug": conv['slug'],
        "title": conv['title'],
        "visibility": conv['visibility'],
        "status": conv['status'],
        "sourceApp": conv['source_app'],
        "sourceSessionId": conv['source_session_id'],
        "sourceProjectKey": conv['source_project_key'],
        "currentRevisionId": conv['current_revision_id'],
        "createdAt": datetime.datetime.fromtimestamp(conv['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        "updatedAt": datetime.datetime.fromtimestamp(conv['updated_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        "repository": None,
        "currentRevision": {
            "id": latest_rev['id'],
            "sourceRevisionHash": latest_rev['source_revision_hash'],
            "parserVersion": latest_rev['parser_version'],
            "canonicalSchemaVersion": latest_rev['canonical_schema_version'],
            "renderSchemaVersion": latest_rev['render_schema_version'],
            "summary": latest_rev['summary'],
            "createdAt": datetime.datetime.fromtimestamp(latest_rev['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        }
    }
    digest = digest_by_rev.get(latest_rev['id'])
    if digest and digest.get('repository'):
        response['repository'] = digest['repository']

    filename = f"GET__conversations__{conv['id']}.json"
    with open(f"{out_dir}/{filename}", "w") as f:
        json.dump(response, f, indent=2)
    print(f"Wrote {filename}")

# ---------------------------------------------------------------
# GET /conversations/:id/digest — per-session digest
# ---------------------------------------------------------------
for conv in conversations[:3]:
    convs_revs = [r for r in revisions if r['conversation_id'] == conv['id']]
    if not convs_revs:
        continue
    latest_rev = max(convs_revs, key=lambda r: r['created_at'])
    digest = digest_by_rev.get(latest_rev['id'])
    if not digest:
        continue

    filename = f"GET__conversations__{conv['id']}__digest.json"
    with open(f"{out_dir}/{filename}", "w") as f:
        json.dump(digest, f, indent=2)
    print(f"Wrote {filename}")

# ---------------------------------------------------------------
# GET /shared/:slug — public conversation (no auth)
# ---------------------------------------------------------------
public_convs = [c for c in conversations if c['visibility'] in ('public', 'unlisted')]
representative_render = None
representative_render_path = f"{out_dir}/GET__conversations__CONV_ID__render__large.json"
if os.path.exists(representative_render_path):
    with open(representative_render_path) as f:
        representative_render = json.load(f)

for conv in public_convs[:2]:
    convs_revs = [r for r in revisions if r['conversation_id'] == conv['id']]
    if not convs_revs:
        continue
    latest_rev = max(convs_revs, key=lambda r: r['created_at'])
    digest = digest_by_rev.get(latest_rev['id'], {})

    response = {
        "conversation": {
            "id": conv['id'],
            "slug": conv['slug'],
            "title": conv['title'],
            "visibility": conv['visibility'],
            "ownerDisplayName": "Abdallah Othman",
            "repository": {"fullName": digest.get('repository')} if digest.get('repository') else None,
            "gitBranch": digest.get('gitBranch'),
            "createdAt": datetime.datetime.fromtimestamp(conv['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
            "updatedAt": datetime.datetime.fromtimestamp(conv['updated_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        },
        "render": representative_render,
        "digest": {
            "sessionType": digest.get('sessionType'),
            "durationMs": digest.get('durationMs'),
            "messageCount": digest.get('messageCount'),
            "toolRunCount": digest.get('toolRunCount'),
            "languages": digest.get('languages', {}),
        }
    }
    filename = f"GET__shared__{conv['slug'][:40]}.json"
    with open(f"{out_dir}/{filename}", "w") as f:
        json.dump(response, f, indent=2)
    print(f"Wrote {filename}")

# ---------------------------------------------------------------
# GET /profile/public/:username — viral public profile
# ---------------------------------------------------------------
if profile_data:
    # Session type distribution from digests
    session_types = {}
    languages = {}
    top_tools = {}
    for d in digests:
        st = d.get('sessionType', 'mixed')
        session_types[st] = session_types.get(st, 0) + 1
        for lang, count in d.get('languages', {}).items():
            languages[lang] = languages.get(lang, 0) + count
        for cat, count in d.get('toolCategories', {}).items():
            top_tools[cat] = top_tools.get(cat, 0) + count

    # Public sessions from the conversations
    public_sessions = []
    for conv in public_convs[:5]:
        convs_revs = [r for r in revisions if r['conversation_id'] == conv['id']]
        if not convs_revs:
            continue
        latest_rev = max(convs_revs, key=lambda r: r['created_at'])
        digest = digest_by_rev.get(latest_rev['id'], {})
        public_sessions.append({
            "conversationId": conv['id'],
            "slug": conv['slug'],
            "title": conv['title'],
            "repository": {"fullName": digest.get('repository')} if digest.get('repository') else None,
            "sessionType": digest.get('sessionType'),
            "messageCount": digest.get('messageCount', 0),
            "durationMs": digest.get('durationMs', 0),
            "firstMessageExcerpt": "",
            "viewCount": 0,  # new endpoint, not yet tracked
            "createdAt": datetime.datetime.fromtimestamp(conv['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z"),
        })

    # Badge generation — deterministic from the real data
    badges = []
    if profile_data['activity']['currentStreak'] >= 7:
        badges.append({"id": "on_fire", "label": "On Fire", "description": f"{profile_data['activity']['currentStreak']}-day streak"})
    total_sessions = profile_data['activity']['totalSessions']
    session_type_dist = profile_data['productivity'].get('sessionTypeDistribution', {})
    if session_type_dist:
        dominant = max(session_type_dist.items(), key=lambda x: x[1])
        if dominant[1] / total_sessions >= 0.3:
            badge_map = {
                "building": ("builder", "Builder", f"{int(dominant[1]/total_sessions*100)}% building"),
                "debugging": ("debugger", "Debugger", f"{int(dominant[1]/total_sessions*100)}% debugging"),
                "exploring": ("explorer", "Explorer", f"{int(dominant[1]/total_sessions*100)}% exploring"),
                "investigating": ("investigator", "Investigator", f"{int(dominant[1]/total_sessions*100)}% investigating"),
                "mixed": ("polymath", "Polymath", f"{int(dominant[1]/total_sessions*100)}% mixed sessions"),
            }
            b = badge_map.get(dominant[0])
            if b:
                badges.append({"id": b[0], "label": b[1], "description": b[2]})

    hourly = profile_data['activity']['hourlyDistribution']
    peak_hour = max(range(24), key=lambda h: hourly[h])
    if peak_hour >= 22 or peak_hour <= 4:
        badges.append({"id": "night_owl", "label": "Night Owl", "description": f"peak {peak_hour:02}:00"})
    elif 5 <= peak_hour <= 9:
        badges.append({"id": "early_bird", "label": "Early Bird", "description": f"peak {peak_hour:02}:00"})

    if profile_data.get('providerProfiles', {}).get('claudeCode', {}).get('cacheHitRate', 0) >= 0.9:
        badges.append({"id": "cache_master", "label": "Cache Master", "description": f"{int(profile_data['providerProfiles']['claudeCode']['cacheHitRate']*100)}% cache hit"})

    top_langs = sorted(languages.items(), key=lambda x: -x[1])[:5]

    public_profile_response = {
        "success": True,
        "user": {
            "username": "abdallah",
            "displayName": "Abdallah Othman",
            "avatarUrl": None,
            "githubUrl": "https://github.com/abdallah",
            "websiteUrl": None,
        },
        "publicSettings": {
            "showActivityHeatmap": True,
            "showCost": False,
            "showRepositories": True,
            "showSessionTypes": True,
            "showToolsLanguages": True,
            "showBadges": True,
        },
        "stats": {
            "sessionCount": profile_data['activity']['totalSessions'],
            "totalHours": round(profile_data['activity']['totalDurationMs'] / 3_600_000, 2),
            "currentStreak": profile_data['activity']['currentStreak'],
            "longestStreak": profile_data['activity']['longestStreak'],
            "firstSessionAt": profile_data['activity']['firstSessionAt'],
            "lastSessionAt": profile_data['activity']['lastSessionAt'],
        },
        "badges": badges,
        "activity": {
            "dailyActivity": profile_data['activity']['dailyActivity'],
            "hourlyDistribution": hourly,
            "weekdayDistribution": profile_data['activity']['weekdayDistribution'],
        },
        "sessionTypes": session_types,
        "languages": dict(top_langs),
        "topTools": [{"name": name, "count": count} for name, count in sorted(top_tools.items(), key=lambda x: -x[1])[:6]],
        "publicSessions": public_sessions,
        "publicRepos": [{"fullName": r['fullName'], "sessionCount": r['sessionCount']} for r in top_repos],
    }
    with open(f"{out_dir}/GET__profile__public__abdallah.json", "w") as f:
        json.dump(public_profile_response, f, indent=2)
    print(f"Wrote GET__profile__public__abdallah.json ({len(badges)} badges, {len(public_sessions)} public sessions)")

# ---------------------------------------------------------------
# GET /api-tokens — CLI token list
# ---------------------------------------------------------------
tokens_response = {
    "success": True,
    "tokens": [
        {
            "id": "token_real",
            "tokenPrefix": "hwi_2f8c",
            "createdAt": "2026-04-09T20:13:51.470Z",
            "lastUsedAt": "2026-04-10T08:16:44.262Z",
            "revokedAt": None,
        },
        {
            "id": "token_old",
            "tokenPrefix": "hwi_8b2d",
            "createdAt": "2026-03-15T10:22:00.000Z",
            "lastUsedAt": "2026-03-28T14:35:11.000Z",
            "revokedAt": "2026-04-09T20:13:51.470Z",
        },
    ]
}
with open(f"{out_dir}/GET__api-tokens.json", "w") as f:
    json.dump(tokens_response, f, indent=2)
print(f"Wrote GET__api-tokens.json")

# ---------------------------------------------------------------
# GET /repos — list of user's repos
# ---------------------------------------------------------------
repos_list = []
for repo_name, count in sorted(top_repos_counts.items(), key=lambda x: -x[1]):
    # Find latest digest for this repo for lastActiveAt
    repo_digests = [d for d in digests if d['repository'] == repo_name]
    latest = max(repo_digests, key=lambda d: d['created_at']) if repo_digests else None
    repos_list.append({
        "fullName": repo_name,
        "provider": "github",
        "sessionCount": count,
        "lastActiveAt": datetime.datetime.fromtimestamp(latest['created_at']/1000, datetime.UTC).isoformat().replace("+00:00", "Z") if latest else None,
    })

repos_response = {
    "success": True,
    "repos": repos_list,
}
with open(f"{out_dir}/GET__repos.json", "w") as f:
    json.dump(repos_response, f, indent=2)
print(f"Wrote GET__repos.json ({len(repos_list)} repos)")

conn.close()
print("Done.")
PY

node revamp/platform-rebuild/mocks/sanitize-mocks.mjs "$DIR"
