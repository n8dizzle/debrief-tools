#!/bin/bash
# Generalized rotation: update a secret env var across all CLI-linked apps + redeploy.
# Reads new value from clipboard (pbpaste).
#
# Usage:  ./scripts/rotate-secret.sh VAR_NAME [--generate]
#   VAR_NAME     env var to rotate (e.g. GOOGLE_CLIENT_SECRET, CRON_SECRET)
#   --generate   generate a new random 32-byte base64 value (instead of reading clipboard)

set -u

if [ $# -lt 1 ]; then
  echo "Usage: $0 VAR_NAME [--generate]"
  echo "  $0 GOOGLE_CLIENT_SECRET         # reads new value from clipboard"
  echo "  $0 CRON_SECRET --generate       # generates new random value"
  exit 1
fi

VAR_NAME="$1"
GENERATE="${2:-}"

APPS=(
  ap-payments
  ar-collections
  ar-outbound
  celebrations
  daily-dash
  doc-dispatch
  hr-hub
  internal-portal
  job-tracker
  labor-dashboard
  marketing-hub
  membership-manager
  payroll-tracker
  sales-command-center
  service-dashboard
  st-audit
  tax-tracker
  video-studio
)

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/rotate-${VAR_NAME}-$(date +%Y%m%d-%H%M%S).log"

# Get new value
if [ "$GENERATE" = "--generate" ]; then
  NEW_VALUE="$(openssl rand -base64 32)"
  echo "Generated new $VAR_NAME (not displayed)."
else
  RAW="$(pbpaste)"
  # Strip leading/trailing whitespace, real newlines, and literal \n / \r sequences
  NEW_VALUE="$(printf '%s' "$RAW" | sed -E 's/\\[nrt]+$//; s/[[:space:]]+$//; s/^[[:space:]]+//')"
  unset RAW
  if [ -z "$NEW_VALUE" ]; then
    echo "ERROR: clipboard is empty. Copy the new secret to clipboard first."
    exit 1
  fi
  if [ ${#NEW_VALUE} -lt 10 ]; then
    echo "ERROR: clipboard value is ${#NEW_VALUE} chars — too short to be a real secret."
    exit 1
  fi
  echo "Using $VAR_NAME from clipboard (${#NEW_VALUE} chars, after trimming)."
fi

echo "Repo:     $REPO"
echo "Log:      $LOG"
echo "Apps:     ${#APPS[@]}"
echo "Var:      $VAR_NAME"
echo ""
echo "Started $(date)" > "$LOG"

# ===================================================================
# Phase 1: update env vars on Vercel
# ===================================================================
echo "=== Phase 1: updating $VAR_NAME on ${#APPS[@]} apps ==="
for app in "${APPS[@]}"; do
  printf "  %-22s " "$app"
  [ -d "$REPO/$app" ] || { echo "SKIP (no dir)"; continue; }
  cd "$REPO/$app"

  for env in production preview development; do
    vercel env rm "$VAR_NAME" "$env" --yes >/dev/null 2>&1 || true
  done

  ok_p=0; ok_pre=0
  printf '%s' "$NEW_VALUE" | vercel env add "$VAR_NAME" production >/dev/null 2>&1 && ok_p=1
  printf '%s' "$NEW_VALUE" | vercel env add "$VAR_NAME" preview    >/dev/null 2>&1 && ok_pre=1

  if [ $ok_p -eq 1 ] && [ $ok_pre -eq 1 ]; then
    echo "OK"
    echo "$app: OK" >> "$LOG"
  else
    echo "PARTIAL (prod=$ok_p preview=$ok_pre)"
    echo "$app: PARTIAL" >> "$LOG"
  fi
done
cd "$REPO"
unset NEW_VALUE

# ===================================================================
# Phase 2: redeploy (parallel)
# ===================================================================
echo ""
echo "=== Phase 2: redeploying ${#APPS[@]} apps in parallel ==="
PIDS=()
for app in "${APPS[@]}"; do
  [ -d "$REPO/$app" ] || continue
  (
    cd "$REPO/$app"
    APP_LOG="/tmp/vercel-${VAR_NAME}-$app.log"
    echo "→ start  $app"
    # internal-portal has path-doubling issue with vercel --prod due to its Root Directory setting;
    # fall back to vercel redeploy on that app specifically.
    if [ "$app" = "internal-portal" ]; then
      LATEST=$(vercel list 2>&1 | grep "Ready" | head -1 | awk '{print $3}')
      if [ -n "$LATEST" ] && vercel redeploy "$LATEST" >"$APP_LOG" 2>&1; then
        echo "✓ done   $app  (via redeploy)"
        echo "$app: deploy OK via redeploy" >> "$LOG"
      else
        echo "✗ FAIL   $app — see $APP_LOG"
        echo "$app: DEPLOY FAILED" >> "$LOG"
      fi
    elif vercel --prod --yes >"$APP_LOG" 2>&1; then
      URL=$(grep -oE 'https://[^ ]*\.vercel\.app' "$APP_LOG" | tail -1)
      echo "✓ done   $app  $URL"
      echo "$app: deploy OK" >> "$LOG"
    else
      echo "✗ FAIL   $app"
      tail -3 "$APP_LOG" | sed "s/^/    /"
      echo "$app: DEPLOY FAILED" >> "$LOG"
    fi
  ) &
  PIDS+=($!)
done

for pid in "${PIDS[@]}"; do
  wait "$pid"
done

echo ""
echo "=== Summary ==="
OK_COUNT=$(grep -c ": deploy OK" "$LOG" 2>/dev/null || true)
FAIL_COUNT=$(grep -c ": DEPLOY FAILED" "$LOG" 2>/dev/null || true)
echo "  Deployed OK: ${OK_COUNT:-0}"
echo "  Deploy FAIL: ${FAIL_COUNT:-0}"
FAILED=$(grep ": DEPLOY FAILED" "$LOG" 2>/dev/null | cut -d: -f1 || true)
[ -n "$FAILED" ] && { echo "Failed apps:"; echo "$FAILED" | sed 's/^/  /'; }
exit 0
