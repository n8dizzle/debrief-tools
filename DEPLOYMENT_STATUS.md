# Deployment Status - Christmas Air Internal Tools

Last Updated: January 4, 2026

## Overview

This repo contains two applications for Christmas Air Conditioning & Plumbing:

1. **That's a Wrap** (`/debrief-qa`) - Job ticket QA/debrief system
2. **Internal Portal** (`/internal-portal`) - Dashboard for internal tools (NOT YET DEPLOYED)

---

## That's a Wrap - LIVE

### Production URL
- **https://debrief.christmasair.com**

### Hosting
- **Platform**: DigitalOcean Droplet
- **IP Address**: 64.225.12.86
- **Cost**: $6/month
- **OS**: Ubuntu 24.04 LTS
- **Region**: NYC3

### Tech Stack
- Python/FastAPI backend
- SQLite database
- Nginx reverse proxy
- Let's Encrypt SSL (auto-renews via Certbot)
- Systemd service (`debrief-qa.service`)

### Server Paths
```
/opt/debrief-qa/              # Git repo root
/opt/debrief-qa/debrief-qa/   # App code (FastAPI)
/opt/debrief-qa/venv/         # Python virtual environment
/opt/debrief-qa/debrief-qa/.env  # Environment variables (NOT in git)
```

### Environment Variables Required (.env)
```
ST_CLIENT_ID=<ServiceTitan client ID>
ST_CLIENT_SECRET=<ServiceTitan client secret>
ST_TENANT_ID=<ServiceTitan tenant ID>
ST_APP_KEY=<ServiceTitan app key>
WEBHOOK_SECRET=<placeholder or real webhook secret>
DATABASE_URL=sqlite:///./debrief.db
```

### Deployment Process

**Option 1: Deploy Script (from Mac)**
```bash
~/deploy-debrief.sh "Commit message"
```

**Option 2: Manual**
```bash
# On Mac - push changes
cd "/Users/nathanlenahan/Desktop/Web Projects/Ticket Checker"
git add . && git commit -m "message" && git push

# On droplet - pull and restart
ssh root@64.225.12.86
cd /opt/debrief-qa && git pull && systemctl restart debrief-qa
```

### SSH Access
```bash
ssh root@64.225.12.86
```
- Uses SSH key at `~/.ssh/id_ed25519`

### Useful Commands (on droplet)
```bash
# Check service status
systemctl status debrief-qa

# View logs
journalctl -u debrief-qa -f

# Restart service
systemctl restart debrief-qa

# Manual sync from ServiceTitan
curl -X POST http://localhost:8000/api/sync?hours_back=24
```

### Data Sync
- **Webhook**: NOT configured (requires ServiceTitan webhook access)
- **Polling**: Cron job runs every 2 minutes to sync completed jobs
- **Manual**: "Sync from ST" button on queue page, or API endpoint
- **Log file**: `/var/log/debrief-sync.log`

### DNS Configuration (Namecheap)
| Type | Host | Value |
|------|------|-------|
| A | debrief | 64.225.12.86 |

---

## Internal Portal - NOT YET DEPLOYED

### Planned URL
- **https://portal.christmasair.com** (not live yet)

### Planned Hosting
- Vercel (free tier)

### Tech Stack
- Next.js
- Google OAuth authentication
- Tailwind CSS

### DNS Required (when deployed)
| Type | Host | Value |
|------|------|-------|
| CNAME | portal | cname.vercel-dns.com |

---

## GitHub Repository

- **URL**: https://github.com/n8dizzle/debrief-tools
- **Visibility**: Private
- **Deploy Key**: Configured on droplet for read-only access

---

## Domain Information

- **Registrar**: Namecheap
- **Main Domain**: christmasair.com (WordPress site - separate hosting)
- **Subdomains managed by us**:
  - debrief.christmasair.com -> DigitalOcean (64.225.12.86)
  - portal.christmasair.com -> Vercel (not yet configured)

---

## What's Working

- [x] DigitalOcean account created
- [x] Droplet provisioned and configured
- [x] That's a Wrap deployed and accessible
- [x] SSL certificate installed (HTTPS)
- [x] Domain DNS configured
- [x] Deploy script created
- [x] Sync polling implemented (no webhooks needed)
- [x] Private GitHub repo with deploy key
- [x] Cron job for automatic sync (every 2 minutes)
- [x] Database connected (Supabase PostgreSQL)
- [x] Production data syncing (138+ jobs loaded)

## What's Pending

- [ ] Internal Portal deployment to Vercel

---

## Troubleshooting

### Site not loading
```bash
ssh root@64.225.12.86
systemctl status debrief-qa
journalctl -u debrief-qa -n 50
```

### No data showing
```bash
curl -X POST http://localhost:8000/api/sync?hours_back=48
```

### Deploy not working
1. Check GitHub push succeeded
2. SSH to droplet and manually: `cd /opt/debrief-qa && git pull`
3. Restart: `systemctl restart debrief-qa`
