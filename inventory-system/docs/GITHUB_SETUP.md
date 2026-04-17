# GitHub Setup Guide

Steps to create the repo, structure it as a monorepo, and get the team working in it with Claude Code.

---

## 1. Create the GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Settings:
   - **Owner:** Your personal account or company org
   - **Repository name:** `inventory-system`
   - **Visibility:** Private
   - **Do NOT** initialize with README (you're pushing existing code)
3. Click **Create repository**

---

## 2. Reorganize Into a Monorepo

Right now the project lives in three separate Desktop folders. Before pushing, consolidate:

```bash
# Create the monorepo folder
mkdir ~/inventory-system
cd ~/inventory-system

# Copy project folders in
cp -r ~/Desktop/inventory-api ./api
cp -r ~/Desktop/inventory-dashboard ./frontend
cp -r ~/Desktop/mock-api ./mock-api

# Copy the setup docs to the root
cp ~/Desktop/inventory-system-setup/CLAUDE.md .
cp ~/Desktop/inventory-system-setup/README.md .
cp ~/Desktop/inventory-system-setup/SUPABASE_SETUP.md .
cp ~/Desktop/inventory-system-setup/api.env.example api/.env.example
cp ~/Desktop/inventory-system-setup/frontend.env.example frontend/.env.example
```

---

## 3. Create .gitignore

Create `~/inventory-system/.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment files — NEVER commit these
.env
.env.local
.env.*.local

# Build output
dist/
build/
.vite/

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/

# Test coverage
coverage/
```

---

## 4. Initialize Git and Push

```bash
cd ~/inventory-system

git init
git add .
git commit -m "Initial commit — inventory system monorepo"

# Add the GitHub remote (replace with your actual URL)
git remote add origin https://github.com/YOUR_ORG/inventory-system.git

git branch -M main
git push -u origin main
```

---

## 5. Set Up Branch Protection

In GitHub → Settings → Branches → Add rule for `main`:
- ✅ Require a pull request before merging
- ✅ Require at least 1 approval
- ✅ Dismiss stale pull request approvals when new commits are pushed

This ensures no one pushes directly to main.

---

## 6. Add Team Members

In GitHub → Settings → Collaborators and teams:
- Add each team member by GitHub username
- Assign role: **Write** (can push branches + open PRs)
- Ray should be **Admin**

---

## 7. Store Secrets for the Team

**Do not put secrets in the repo.** Instead:

1. Add the Supabase DATABASE_URL, JWT_SECRET, and JWT_REFRESH_SECRET to your team password manager (1Password, Bitwarden, Notion with access controls, etc.)
2. Each developer copies `api/.env.example` to `api/.env` and fills in the values from the password manager
3. For production deploys, use environment variables in your hosting provider (Railway, Render, Fly.io, etc.)

---

## 8. Set Up Claude Code for Each Developer

Once the repo is cloned, each developer can run Claude Code with full project context:

```bash
# Install Claude Code (if not already installed)
npm install -g @anthropic/claude-code

# From the repo root
cd ~/inventory-system
claude

# Claude Code reads CLAUDE.md automatically and has full project context
```

Claude Code will pick up `CLAUDE.md` from the repo root and understand the full architecture, conventions, and patterns without needing to re-explain them each session.

**For the team:** encourage everyone to run Claude Code from the repo root so it always has the full monorepo context.

---

## 9. Recommended Branch Workflow

```
main           — production-ready, protected
staging        — pre-production testing
feature/...    — individual features (e.g. feature/typescript-migration)
fix/...        — bug fixes
chore/...      — non-feature work (deps, docs, refactor)
```

PR naming: `feat: add warranty expiry alerts` / `fix: correct transfer endpoint validation`

---

## One Thing That Still Needs Your Input

When you said you have defined company standards, those didn't come through in the form. Before the team starts working in Claude Code, create a `STANDARDS.md` in the repo root with your company's requirements — things like:

- TypeScript requirement (yes/no, and migration timeline if yes)
- ESLint / Prettier config
- Test coverage minimums
- PR review requirements
- Deployment targets (Railway, Render, Vercel, self-hosted, etc.)
- Any required security policies (secrets scanning, dependency auditing, etc.)

Once `STANDARDS.md` exists, add a reference to it in `CLAUDE.md` so Claude Code enforces those standards in every session automatically.
