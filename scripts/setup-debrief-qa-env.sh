#!/bin/bash
# Populate debrief-qa Vercel project env vars by copying from existing apps +
# generating what needs generating. Writes to Production only (staging via prod deploy).
#
# Values NOT set here (user must add manually in Vercel UI or via `vercel env add`):
#   DATABASE_URL       — from Supabase dashboard (Database → Connection String → Transaction mode)
#   GOOGLE_AI_API_KEY  — from Google AI Studio
#   WEBHOOK_SECRET     — from ServiceTitan webhook config (or generate + update ST)

set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$REPO/debrief-qa"
SRC_A="$REPO/daily-dash"
SRC_B="$REPO/internal-portal"

TMP_A=$(mktemp)
TMP_B=$(mktemp)
trap 'rm -f "$TMP_A" "$TMP_B"' EXIT

echo "Pulling source env vars..."
(cd "$SRC_A" && vercel env pull "$TMP_A" --environment=production --yes >/dev/null 2>&1)
(cd "$SRC_B" && vercel env pull "$TMP_B" --environment=production --yes >/dev/null 2>&1)

# Helper: extract a var's clean value from a pulled .env file
get_var() {
  local file="$1"; local name="$2"
  grep "^${name}=" "$file" \
    | sed -E "s/^${name}=//" \
    | sed -E 's/^"(.*)"$/\1/' \
    | sed -E 's/\\[nrt]+$//; s/[[:space:]]+$//' \
    | tr -d '\n\r'
}

# Set a var on debrief-qa (production) — removes any existing first
set_var() {
  local name="$1"; local value="$2"
  [ -z "$value" ] && { echo "  ${name}: SKIP (empty source)"; return; }
  (cd "$DEST" && vercel env rm "$name" production --yes >/dev/null 2>&1 || true)
  printf '%s' "$value" | (cd "$DEST" && vercel env add "$name" production >/dev/null 2>&1) \
    && echo "  ${name}: set (${#value} chars)" \
    || echo "  ${name}: FAILED"
}

echo ""
echo "Copying from daily-dash (ServiceTitan + Google)..."
set_var ST_CLIENT_ID        "$(get_var "$TMP_A" ST_CLIENT_ID)"
set_var ST_CLIENT_SECRET    "$(get_var "$TMP_A" ST_CLIENT_SECRET)"
set_var ST_TENANT_ID        "$(get_var "$TMP_A" ST_TENANT_ID)"
set_var ST_APP_KEY          "$(get_var "$TMP_A" ST_APP_KEY)"
set_var GOOGLE_CLIENT_ID    "$(get_var "$TMP_A" GOOGLE_CLIENT_ID)"
set_var GOOGLE_CLIENT_SECRET "$(get_var "$TMP_A" GOOGLE_CLIENT_SECRET)"

echo ""
echo "Copying from internal-portal (SSO)..."
set_var INTERNAL_API_SECRET "$(get_var "$TMP_B" INTERNAL_API_SECRET)"

echo ""
echo "Setting known constants..."
set_var PORTAL_URL "https://portal.christmasair.com"
set_var BASE_URL   "https://debrief-qa.vercel.app"

echo ""
echo "Generating SECRET_KEY..."
set_var SECRET_KEY "$(openssl rand -base64 32)"

echo ""
echo "=== Remaining env vars you must set manually ==="
echo "  DATABASE_URL       — get from Supabase dashboard (Transaction Pooler URL)"
echo "  GOOGLE_AI_API_KEY  — get from Google AI Studio"
echo "  WEBHOOK_SECRET     — from ServiceTitan webhook config (optional for initial testing)"
echo ""
echo "Set each with:"
echo '  cd debrief-qa && echo -n "VALUE" | vercel env add VAR_NAME production'
