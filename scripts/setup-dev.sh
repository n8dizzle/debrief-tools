#!/bin/bash
# One-time developer setup for debrief-tools.
# Run once per machine after cloning. Idempotent — safe to re-run.

set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo "=== Dev setup for debrief-tools ==="
echo ""

# ---- pre-commit + gitleaks (secret scanning) ----
echo "→ Checking for gitleaks and pre-commit..."
need_install=()
command -v gitleaks >/dev/null 2>&1 || need_install+=(gitleaks)
command -v pre-commit >/dev/null 2>&1 || need_install+=(pre-commit)

if [ ${#need_install[@]} -gt 0 ]; then
  echo "  installing: ${need_install[*]}"
  if command -v brew >/dev/null 2>&1; then
    brew install "${need_install[@]}"
  else
    echo "ERROR: Homebrew not found. Install gitleaks and pre-commit manually:"
    echo "  https://github.com/gitleaks/gitleaks#installing"
    echo "  https://pre-commit.com/#install"
    exit 1
  fi
else
  echo "  ✓ both installed"
fi

echo ""
echo "→ Installing git pre-commit hook..."
pre-commit install >/dev/null
echo "  ✓ hook installed at .git/hooks/pre-commit"

echo ""
echo "→ Verifying hook works (running against a noop file)..."
if pre-commit run --all-files gitleaks >/dev/null 2>&1; then
  echo "  ✓ gitleaks scan passes on current tree"
else
  echo "  ⚠ gitleaks reported findings — check output with: pre-commit run --all-files gitleaks"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Every 'git commit' from this machine now runs gitleaks on the staged diff."
echo "To bypass in an emergency: git commit --no-verify   (CI will still catch it)"
echo ""
echo "If you clone this repo on another machine, re-run this script there."
