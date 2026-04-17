#!/bin/bash
# Rotate SUPABASE_SERVICE_ROLE_KEY across all CLI-linked apps.
# Runs in two phases, separated by a manual confirm:
#   Phase 1 — update env vars (safe; running prod still on old key).
#   Phase 2 — trigger production redeploys (new key goes live).

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
# Excluded on purpose:
#   internal-portal — already rotated and verified
#   gideon-track, sales-command-center — no .vercel/project.json (not CLI-linked)

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/supabase-rotation-$(date +%Y%m%d-%H%M%S).log"

echo "Repo: $REPO"
echo "Log:  $LOG"
echo "Apps: ${#APPS[@]}"
echo ""

# Key source priority: $SUPABASE_KEY env var > macOS clipboard > interactive prompt
if [ -n "${SUPABASE_KEY:-}" ]; then
  NEW_KEY="$SUPABASE_KEY"
  echo "Using key from \$SUPABASE_KEY env var."
elif command -v pbpaste >/dev/null 2>&1; then
  CLIPBOARD="$(pbpaste)"
  if [[ "$CLIPBOARD" == sb_secret_* ]]; then
    NEW_KEY="$CLIPBOARD"
    echo "Using key from clipboard (starts with sb_secret_)."
  else
    echo "ERROR: Clipboard doesn't look like an sb_secret_ key."
    echo "Copy the new Supabase secret key to your clipboard first, then re-run."
    echo "Or set SUPABASE_KEY env var: SUPABASE_KEY=sb_secret_xxx $0"
    exit 1
  fi
else
  printf "Paste the new SUPABASE_SERVICE_ROLE_KEY value (input hidden): "
  read -s NEW_KEY
  echo ""
fi

if [ -z "$NEW_KEY" ]; then
  echo "ERROR: empty key. Aborting."
  exit 1
fi

if [[ "$NEW_KEY" != sb_secret_* ]]; then
  printf "WARNING: key doesn't start with 'sb_secret_'. Continue? (y/N) "
  read confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

echo "Rotation started $(date)" > "$LOG"

# ===================================================================
# Phase 1: update env vars
# ===================================================================
echo ""
echo "=== Phase 1: updating env vars (Production + Preview) ==="
echo ""

FAILED_ENV=()
for app in "${APPS[@]}"; do
  printf "  %-22s " "$app"
  if [ ! -d "$REPO/$app" ]; then
    echo "SKIP (missing dir)"
    echo "$app: SKIP missing dir" >> "$LOG"
    continue
  fi
  cd "$REPO/$app"

  # Remove any existing value (ignore errors — may not exist)
  for env in production preview development; do
    vercel env rm SUPABASE_SERVICE_ROLE_KEY "$env" --yes >/dev/null 2>&1 || true
  done

  # Add new value to Production + Preview
  ok_p=0; ok_pre=0
  echo "$NEW_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production >/dev/null 2>&1 && ok_p=1
  echo "$NEW_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview    >/dev/null 2>&1 && ok_pre=1

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
  echo "   Check $LOG — you may need to fix these in the Vercel UI."
else
  echo "✓  All env vars updated."
fi

# ===================================================================
# Phase 2 confirmation
# ===================================================================
echo ""
echo "=== Phase 2: redeploy to production ==="
echo "This triggers 'vercel --prod' on each app in parallel."
echo "Until this runs, production is STILL using the OLD (leaked) key."
echo ""
printf "Proceed with redeploys? (y/N) "
read confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Stopped after Phase 1. Env vars are staged; no apps redeployed yet."
  echo "Re-run and answer 'y' to Phase 2 when ready."
  unset NEW_KEY
  exit 0
fi

unset NEW_KEY  # don't need it past this point

# ===================================================================
# Phase 2: redeploys (parallel)
# ===================================================================
PIDS=()
for app in "${APPS[@]}"; do
  [ -d "$REPO/$app" ] || continue
  (
    cd "$REPO/$app"
    echo "→ starting: $app"
    if vercel --prod --yes >/tmp/vercel-$app.log 2>&1; then
      echo "✓ done: $app"
      echo "$app: deploy OK" >> "$LOG"
    else
      echo "✗ FAILED: $app — see /tmp/vercel-$app.log"
      echo "$app: DEPLOY FAILED" >> "$LOG"
    fi
  ) &
  PIDS+=($!)
done

echo ""
echo "Waiting on ${#PIDS[@]} parallel deploys..."
for pid in "${PIDS[@]}"; do
  wait "$pid"
done

echo ""
echo "=== Done. Summary in $LOG ==="
grep -E "DEPLOY FAILED|PARTIAL" "$LOG" || echo "No failures logged."
