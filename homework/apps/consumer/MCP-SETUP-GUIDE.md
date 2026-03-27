# Claude Code MCP Setup for Homework

## Overview

MCP (Model Context Protocol) lets Claude Code connect directly to external services. This guide covers setting up the connections you'll need for Homework.

---

## Quick Setup (Recommended)

Claude Code stores MCP config in `~/.claude.json` (Mac/Linux) or your home directory on Windows.

### Step 1: Create/Edit the Config File

```bash
# Create or edit the Claude Code config
nano ~/.claude.json
```

### Step 2: Add This Configuration

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "supabase-mcp@latest",
        "supabase-mcp-claude"
      ],
      "env": {
        "SUPABASE_URL": "YOUR_SUPABASE_PROJECT_URL",
        "SUPABASE_ANON_KEY": "YOUR_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SUPABASE_SERVICE_ROLE_KEY"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/YOUR_USERNAME/homework-app"
      ]
    }
  }
}
```

### Step 3: Replace the Placeholders

| Placeholder | Where to Find It |
|-------------|------------------|
| `YOUR_SUPABASE_PROJECT_URL` | Supabase Dashboard → Settings → API → Project URL |
| `YOUR_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |
| `YOUR_SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `YOUR_GITHUB_TOKEN` | GitHub → Settings → Developer Settings → Personal Access Tokens |
| `YOUR_USERNAME` | Your Mac/Linux username (for filesystem path) |

---

## What Each MCP Server Does

### Supabase MCP
Lets Claude Code:
- Query your database tables
- Run SQL commands
- Check RLS policies
- Manage schema

**Example prompts:**
```
> List all tables in my Supabase database
> Show me the schema for the homes table
> Run a query to count equipment by brand
> Check if RLS is enabled on the orders table
```

### GitHub MCP
Lets Claude Code:
- Create branches
- Make commits
- Open pull requests
- Manage issues

**Example prompts:**
```
> Create a new branch called feature/equipment-scanner
> Commit these changes with message "Add equipment card component"
> Show me open issues in the homework-app repo
```

### Filesystem MCP
Lets Claude Code:
- Read and write files in your project
- Navigate your codebase
- Create new files

**Note:** Claude Code has built-in filesystem access, but this MCP can provide additional capabilities.

---

## Getting Your Credentials

### Supabase Credentials

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token** (classic)
3. Select scopes:
   - `repo` (full control of private repos)
   - `read:org` (if using organization repos)
4. Copy the token (you won't see it again)

---

## Alternative: Hosted Supabase MCP (OAuth)

Supabase also offers a hosted MCP server with OAuth authentication. This is newer and doesn't require storing credentials locally:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF"
    }
  }
}
```

When you first use it, Claude Code will prompt you to authenticate via browser. This is more secure but requires browser access.

Get your `project_ref` from: Supabase Dashboard → Settings → General → Reference ID

---

## Verifying MCP Connections

After setting up, start Claude Code and test the connections:

```bash
# Start Claude Code in your project
cd ~/homework-app
claude

# Then ask Claude to verify:
> Check my Supabase connection and list the tables
> Verify GitHub access and show my repos
```

If a connection fails:
1. Check for typos in `~/.claude.json`
2. Verify your credentials are correct
3. Make sure you have the required permissions

---

## Security Notes

1. **Never commit credentials** - The `~/.claude.json` file is in your home directory, not your project, so it won't be committed to git.

2. **Service role key is powerful** - It bypasses RLS. Only use it for admin operations. For normal queries, Claude Code will respect your RLS policies.

3. **GitHub token scope** - Only grant the permissions you need. `repo` scope gives full access to private repos.

4. **Rotate credentials** - If you suspect a leak, regenerate your tokens immediately.

---

## Troubleshooting

### "MCP server not connecting"
```bash
# Test if the MCP server runs manually
npx -y supabase-mcp@latest supabase-mcp-claude

# If it fails, check your Node.js version (need 18+)
node --version
```

### "Permission denied" errors
- Check that your Supabase credentials have the right access
- Verify RLS policies allow the operation

### "GitHub authentication failed"
- Make sure your token hasn't expired
- Verify the token has the required scopes

### Claude Code seems to ignore MCP
- Restart Claude Code after changing config
- Make sure `~/.claude.json` is valid JSON (no trailing commas)

---

## Next Steps

Once MCP is configured:

1. Start Claude Code: `claude`
2. Have it read your project context: `> Read CLAUDE.md and confirm you understand the project`
3. Begin building: `> Initialize a Next.js 14 project with TypeScript and Tailwind`

Claude Code can now query your actual database, commit to GitHub, and build your project with full context.
