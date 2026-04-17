#!/bin/bash
# Update ST_CLIENT_SECRET on the debrief-qa droplet.
# Reads new value from clipboard, pipes via SSH (value never appears on command line).

set -u

HOST="root@64.225.12.86"
ENV_FILE="/opt/debrief-qa/debrief-qa/.env"

NEW_SECRET="$(pbpaste)"
if [ -z "$NEW_SECRET" ] || [ ${#NEW_SECRET} -lt 10 ]; then
  echo "ERROR: clipboard is empty or too short. Re-copy the new ST_CLIENT_SECRET first."
  exit 1
fi

echo "Connecting to $HOST..."
echo "(you may be prompted for SSH key passphrase/password)"
echo ""

# Pipe the secret over stdin to avoid exposing it on the command line or in logs.
echo "$NEW_SECRET" | ssh "$HOST" "bash -s" <<'REMOTE'
set -eu
NEW_SECRET=$(cat)
ENV_FILE="/opt/debrief-qa/debrief-qa/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found on droplet" >&2
  exit 1
fi

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

if grep -q "^ST_CLIENT_SECRET=" "$ENV_FILE"; then
  # Use | as sed delimiter to avoid clashes with / in the secret
  sed -i "s|^ST_CLIENT_SECRET=.*|ST_CLIENT_SECRET=${NEW_SECRET}|" "$ENV_FILE"
  echo "✓ updated ST_CLIENT_SECRET in $ENV_FILE"
else
  echo "ST_CLIENT_SECRET=${NEW_SECRET}" >> "$ENV_FILE"
  echo "✓ appended ST_CLIENT_SECRET to $ENV_FILE (was missing)"
fi

systemctl restart debrief-qa
sleep 2
STATUS=$(systemctl is-active debrief-qa)
echo "debrief-qa service: $STATUS"
[ "$STATUS" = "active" ] || exit 2
REMOTE

echo ""
echo "Droplet update complete."
