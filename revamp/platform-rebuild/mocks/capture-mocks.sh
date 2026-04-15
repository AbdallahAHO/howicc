#!/bin/bash
set -e

TOKEN="${HOWICC_MOCK_TOKEN:?Set HOWICC_MOCK_TOKEN before running this script}"
BASE="${HOWICC_MOCK_BASE:-http://localhost:8787}"
DIR="revamp/platform-rebuild/mocks/api-responses"
AUTH_H="Authorization: Bearer $TOKEN"

mkdir -p "$DIR"

# 1. Health
curl -sS -X GET "$BASE/health" -o "$DIR/GET__health.json"

# 2. CLI auth whoami
curl -sS -X GET "$BASE/cli-auth/whoami" -H "$AUTH_H" -o "$DIR/GET__cli-auth__whoami.json"

# 3. List conversations
curl -sS -X GET "$BASE/conversations" -H "$AUTH_H" -o "$DIR/GET__conversations.json"

# 4. Profile (full)
curl -sS -X GET "$BASE/profile" -H "$AUTH_H" -o "$DIR/GET__profile.json"

# 5. Pricing models
curl -sS -X GET "$BASE/pricing/models" -o "$DIR/GET__pricing__models.json"

# Per-conversation endpoints — use the first conversation in the list
FIRST_CONV_ID=$(python3 -c "import json; d=json.load(open('$DIR/GET__conversations.json')); print(d['conversations'][0]['id'])")
echo "Using conversation: $FIRST_CONV_ID"

# 6. Render document for first conversation
curl -sS -X GET "$BASE/conversations/$FIRST_CONV_ID/render" -H "$AUTH_H" -o "$DIR/GET__conversations__CONV_ID__render.json"

# 7. Try a second conversation too (with more content)
SECOND_CONV_ID=$(python3 -c "import json; d=json.load(open('$DIR/GET__conversations.json')); print(d['conversations'][2]['id'] if len(d['conversations']) > 2 else d['conversations'][0]['id'])")
echo "Using second conversation: $SECOND_CONV_ID"
curl -sS -X GET "$BASE/conversations/$SECOND_CONV_ID/render" -H "$AUTH_H" -o "$DIR/GET__conversations__CONV_ID__render__large.json"

# 8. Repo page (existing endpoint, ungated version)
curl -sS -X GET "$BASE/repo/axetay/really-app" -o "$DIR/GET__repo__axetay__really-app.json"
curl -sS -X GET "$BASE/repo/personal/howicc" -o "$DIR/GET__repo__personal__howicc.json"

node revamp/platform-rebuild/mocks/sanitize-mocks.mjs "$DIR"

echo "Done. Files saved to $DIR:"
ls -la "$DIR"
