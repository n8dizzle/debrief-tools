#!/bin/bash
# Rotate ST_CLIENT_SECRET across all CLI-linked apps + debrief-qa droplet.
# Reads new value from clipboard (copy it in ServiceTitan dev portal first).

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
# Excluded: gideon-track (never deployed), referrals (other session)
# Note: droplet handled separately at end of script

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/st-rotation-$(date +%Y%m%d-%H%M%S).log"
DROPLET_HOST="root@64.225.12.86"
DROPLET_ENV="/opt/debrief-qa/debrief-qa/.env"

# Read from clipboard
CLIPBOARD="$(pbpaste)"
if [ -z "$CLIPBOARD" ]; then
  echo "ERROR: clipboard is empty."
  exit 1
fi
if [ ${#CLIPBOARD} -lt 20 ] || [ ${#CLIPBOARD} -gt 200 ]; then
  echo "WARNING: clipboard value is ${#CLIPBOARD} chars — doesn't look like a typical ST secret."
  echo "Expected ~30-80 chars. Abort and re-copy if this is wrong."
  printf "Continue anyway? (y/N) "
  read confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

NEW_SECRET="$CLIPBOARD"
unset CLIPBOARD

echo "Repo:     $REPO"
echo "Log:      $LOG"
echo "Apps:     ${#APPS[@]}"
echo "Var name: ST_CLIENT_SECRET"
echo ""
echo "Started $(date)" > "$LOG"

# ===================================================================
# Phase 1: update env vars on Vercel
# ===================================================================
echo "=== Phase 1: updating ST_CLIENT_SECRET on ${#APPS[@]} apps ==="
echo ""

for app in "${APPS[@]}"; do
  printf "  %-22s " "$app"
  [ -d "$REPO/$app" ] || { echo "SKIP (no dir)"; continue; }
  cd "$REPO/$app"

  for env in production preview development; do
    vercel env rm ST_CLIENT_SECRET "$env" --yes >/dev/null 2>&1 || true
  done

  ok_p=0; ok_pre=0
  echo "$NEW_SECRET" | vercel env add ST_CLIENT_SECRET production >/dev/null 2>&1 && ok_p=1
  echo "$NEW_SECRET" | vercel env add ST_CLIENT_SECRET preview    >/dev/null 2>&1 && ok_pre=1

  if [ $ok_p -eq 1 ] && [ $ok_pre -eq 1 ]; then
    echo "OK"
    echo "$app: OK" >> "$LOG"
  else
    echo "PARTIAL (prod=$ok_p preview=$ok_pre)"
    echo "$app: PARTIAL" >> "$LOG"
  fi
done
cd "$REPO"
echo ""

# ===================================================================
# Phase 2: update debrief-qa droplet
# ===================================================================
echo "=== Phase 2: updating debrief-qa droplet ($DROPLET_HOST) ==="
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$DROPLET_HOST" "test -f $DROPLET_ENV" 2>/dev/null; then
  # Update .env and restart service. Uses heredoc to avoid secret on command line.
  ssh "$DROPLET_HOST" "bash -s" <<EOF >>"$LOG" 2>&1
cp "$DROPLET_ENV" "${DROPLET_ENV}.bak.\$(date +%s)"
# Replace the ST_CLIENT_SECRET line, or add if missing
if grep -q "^ST_CLIENT_SECRET=" "$DROPLET_ENV"; then
  sed -i "s|^ST_CLIENT_SECRET=.*|ST_CLIENT_SECRET=$NEW_SECRET|" "$DROPLET_ENV"
else
  echo "ST_CLIENT_SECRET=$NEW_SECRET" >> "$DROPLET_ENV"
fi
systemctl restart debrief-qa
sleep 2
systemctl is-active debrief-qa
EOF
  echo "  ✓ droplet updated and service restarted"
else
  echo "  ✗ could not SSH to $DROPLET_HOST — update droplet manually:"
  echo "    ssh $DROPLET_HOST"
  echo "    nano $DROPLET_ENV   # change ST_CLIENT_SECRET= line"
  echo "    systemctl restart debrief-qa"
fi
unset NEW_SECRET
echo ""

# ===================================================================
# Phase 3: redeploy Vercel apps in parallel
# ===================================================================
echo "=== Phase 3: redeploying ${#APPS[@]} apps in parallel ==="
echo ""

PIDS=()
for app in "${APPS[@]}"; do
  [ -d "$REPO/$app" ] || continue
  (
    cd "$REPO/$app"
    APP_LOG="/tmp/vercel-st-$app.log"
    echo "→ start  $app"
    if vercel --prod --yes >"$APP_LOG" 2>&1; then
      URL=$(grep -oE 'https://[^ ]*\.vercel\.app' "$APP_LOG" | tail -1)
      echo "✓ done   $app  $URL"
      echo "$app: deploy OK" >> "$LOG"
    else
      echo "✗ FAIL   $app"
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
grep -c ": deploy OK" "$LOG" 2>/dev/null | xargs -I{} echo "  Deployed OK: {}"
grep -c ": DEPLOY FAILED" "$LOG" 2>/dev/null | xargs -I{} echo "  Deploy FAIL: {}"
FAILED=$(grep ": DEPLOY FAILED" "$LOG" 2>/dev/null | cut -d: -f1)
if [ -n "$FAILED" ]; then
  echo "Failed apps:"
  echo "$FAILED" | sed 's/^/  /'
fi
