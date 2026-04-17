#!/bin/bash
# Rotate NEXTAUTH_SECRET across all 19 CLI-linked Christmas Air apps.
# Generates a fresh random secret, applies to every app, triggers redeploy.
#
# Side effect: every currently-logged-in user gets signed out.
# Must use the SAME value across all apps for SSO cookie to keep working.

set -u

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
# Excluded: gideon-track (never deployed), referrals (other session working on it)

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/nextauth-rotation-$(date +%Y%m%d-%H%M%S).log"

# Generate new secret
NEW_SECRET="$(openssl rand -base64 32)"

echo "Repo:      $REPO"
echo "Log:       $LOG"
echo "Apps:      ${#APPS[@]}"
echo "Var name:  NEXTAUTH_SECRET"
echo "New value: (generated, not displayed)"
echo ""
echo "Started $(date)" > "$LOG"

# ===================================================================
# Phase 1: update env vars (Production + Preview) for every app
# ===================================================================
echo "=== Phase 1: updating NEXTAUTH_SECRET on all apps ==="
echo ""

FAILED_ENV=()
for app in "${APPS[@]}"; do
  printf "  %-22s " "$app"
  if [ ! -d "$REPO/$app" ]; then
    echo "SKIP (missing dir)"
    echo "$app: SKIP missing" >> "$LOG"
    continue
  fi
  cd "$REPO/$app"

  # Remove existing (ignore errors)
  for env in production preview development; do
    vercel env rm NEXTAUTH_SECRET "$env" --yes >/dev/null 2>&1 || true
  done

  # Add new to Production + Preview
  ok_p=0; ok_pre=0
  echo "$NEW_SECRET" | vercel env add NEXTAUTH_SECRET production >/dev/null 2>&1 && ok_p=1
  echo "$NEW_SECRET" | vercel env add NEXTAUTH_SECRET preview    >/dev/null 2>&1 && ok_pre=1

  if [ $ok_p -eq 1 ] && [ $ok_pre -eq 1 ]; then
    echo "OK"
    echo "$app: env var updated" >> "$LOG"
  else
    echo "PARTIAL (prod=$ok_p preview=$ok_pre)"
    echo "$app: PARTIAL prod=$ok_p preview=$ok_pre" >> "$LOG"
    FAILED_ENV+=("$app")
  fi
done
cd "$REPO"

echo ""
if [ ${#FAILED_ENV[@]} -gt 0 ]; then
  echo "⚠  Env update issues on: ${FAILED_ENV[*]}"
else
  echo "✓  NEXTAUTH_SECRET updated on all ${#APPS[@]} apps."
fi

# ===================================================================
# Phase 2: redeploy all (parallel)
# ===================================================================
echo ""
echo "=== Phase 2: redeploying all apps in parallel ==="
echo ""

unset NEW_SECRET

PIDS=()
for app in "${APPS[@]}"; do
  [ -d "$REPO/$app" ] || continue
  (
    cd "$REPO/$app"
    APP_LOG="/tmp/vercel-nextauth-$app.log"
    echo "→ start  $app"
    if vercel --prod --yes >"$APP_LOG" 2>&1; then
      URL=$(grep -oE 'https://[^ ]*\.vercel\.app' "$APP_LOG" | tail -1)
      echo "✓ done   $app  $URL"
      echo "$app: deploy OK" >> "$LOG"
    else
      echo "✗ FAIL   $app — tail of $APP_LOG:"
      tail -4 "$APP_LOG" | sed "s/^/    /"
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
grep -c ": deploy OK" "$LOG" 2>/dev/null | xargs -I{} echo "  OK:   {}"
grep -c ": DEPLOY FAILED" "$LOG" 2>/dev/null | xargs -I{} echo "  FAIL: {}"
echo ""
FAILED=$(grep ": DEPLOY FAILED" "$LOG" 2>/dev/null | cut -d: -f1)
if [ -n "$FAILED" ]; then
  echo "Failed apps:"
  echo "$FAILED" | sed 's/^/  /'
fi
echo ""
echo "Reminder: all users are now signed out. They'll need to log in again."
