#!/bin/bash
# One-off rotation for sales-command-center (wasn't CLI-linked during main rotation).
# Reads key from clipboard (same as rotate-supabase-key.sh).

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="sales-command-center"
cd "$REPO/$APP"

CLIPBOARD="$(pbpaste)"
if [[ "$CLIPBOARD" != sb_secret_* ]]; then
  echo "ERROR: Clipboard doesn't look like an sb_secret_ key."
  echo "Copy the new key to clipboard from Supabase dashboard first."
  exit 1
fi

echo "Using key from clipboard."
echo ""

echo "=== Removing old SUPABASE_SERVICE_ROLE_KEY ==="
for env in production preview development; do
  vercel env rm SUPABASE_SERVICE_ROLE_KEY "$env" --yes 2>&1 | tail -1
done

echo ""
echo "=== Adding new SUPABASE_SERVICE_ROLE_KEY (Production + Preview) ==="
echo "$CLIPBOARD" | vercel env add SUPABASE_SERVICE_ROLE_KEY production 2>&1 | tail -2
echo "$CLIPBOARD" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview    2>&1 | tail -2

unset CLIPBOARD

echo ""
echo "=== Deploying to production ==="
vercel --prod --yes 2>&1 | tail -10
