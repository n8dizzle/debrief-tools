#!/bin/bash
# Redeploy all 17 apps to production in parallel.
# Run this AFTER rotate-supabase-key.sh has finished Phase 1.

set -u

APPS=(
  ap-payments
  ar-collections
  ar-outbound
  celebrations
  daily-dash
  doc-dispatch
  hr-hub
  job-tracker
  labor-dashboard
  marketing-hub
  membership-manager
  payroll-tracker
  referrals
  service-dashboard
  st-audit
  tax-tracker
  video-studio
)

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/redeploy-$(date +%Y%m%d-%H%M%S).log"

echo "Repo: $REPO"
echo "Log:  $LOG"
echo "Deploying ${#APPS[@]} apps to production in parallel..."
echo ""

PIDS=()
for app in "${APPS[@]}"; do
  [ -d "$REPO/$app" ] || { echo "SKIP $app (no dir)"; continue; }
  (
    cd "$REPO/$app"
    APP_LOG="/tmp/vercel-$app.log"
    echo "→ start  $app"
    if vercel --prod --yes >"$APP_LOG" 2>&1; then
      URL=$(grep -oE 'https://[^ ]*\.vercel\.app' "$APP_LOG" | tail -1)
      echo "✓ done   $app  $URL"
      echo "$app: OK $URL" >> "$LOG"
    else
      echo "✗ FAIL   $app — tail of $APP_LOG:"
      tail -5 "$APP_LOG" | sed "s/^/    /"
      echo "$app: FAIL" >> "$LOG"
    fi
  ) &
  PIDS+=($!)
done

for pid in "${PIDS[@]}"; do
  wait "$pid"
done

echo ""
echo "=== Summary ==="
grep -c ": OK" "$LOG" 2>/dev/null | xargs -I{} echo "  OK:   {}"
grep -c ": FAIL" "$LOG" 2>/dev/null | xargs -I{} echo "  FAIL: {}"
echo ""
FAILED=$(grep ": FAIL" "$LOG" 2>/dev/null | cut -d: -f1)
if [ -n "$FAILED" ]; then
  echo "Failed apps:"
  echo "$FAILED" | sed 's/^/  /'
  echo ""
  echo "Per-app logs at: /tmp/vercel-<app>.log"
fi
