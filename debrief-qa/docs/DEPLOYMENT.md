# Deployment Guide - DigitalOcean

## Step 1: Create Droplet

1. Log into DigitalOcean
2. Create → Droplets
3. Select:
   - Ubuntu 24.04 LTS
   - Basic (Regular SSD)
   - $6/month (1 vCPU, 1GB RAM) — plenty for this
   - Select your region (closest to Texas = NYC or SFO)
   - Authentication: SSH keys (recommended) or password
4. Create Droplet

## Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

Update and install dependencies:
```bash
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git
```

Create app user (don't run as root):
```bash
adduser --system --group debrief
mkdir -p /opt/debrief-qa
chown debrief:debrief /opt/debrief-qa
```

## Step 3: Deploy Application

Clone or upload your code:
```bash
cd /opt/debrief-qa
# Option A: Git clone (if you push to GitHub)
git clone https://github.com/YOUR_REPO/debrief-qa.git .

# Option B: SCP from your machine
# scp -r ./debrief-qa/* root@YOUR_DROPLET_IP:/opt/debrief-qa/
```

Setup Python environment:
```bash
cd /opt/debrief-qa
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create environment file:
```bash
cp .env.example .env
nano .env  # Edit with your actual credentials
```

Initialize database:
```bash
source venv/bin/activate
python -c "from app.database import init_db; init_db()"
```

## Step 4: Setup Systemd Service

Create service file:
```bash
nano /etc/systemd/system/debrief-qa.service
```

Paste this:
```ini
[Unit]
Description=Debrief QA System
After=network.target

[Service]
User=debrief
Group=debrief
WorkingDirectory=/opt/debrief-qa
Environment="PATH=/opt/debrief-qa/venv/bin"
ExecStart=/opt/debrief-qa/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl daemon-reload
systemctl enable debrief-qa
systemctl start debrief-qa
systemctl status debrief-qa  # Check it's running
```

## Step 5: Setup Nginx Reverse Proxy

Create nginx config:
```bash
nano /etc/nginx/sites-available/debrief-qa
```

Paste this (replace YOUR_DOMAIN):
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/debrief-qa /etc/nginx/sites-enabled/
nginx -t  # Test config
systemctl restart nginx
```

## Step 6: Setup SSL (HTTPS)

Required for ServiceTitan webhooks!

```bash
certbot --nginx -d YOUR_DOMAIN.com
```

Follow prompts. Certbot will auto-configure nginx for HTTPS.

## Step 7: Configure DNS

Point your domain to the droplet IP:
- A record: `debrief.christmasac.com` → `YOUR_DROPLET_IP`

Wait for DNS propagation (usually 5-15 minutes).

## Step 8: Setup ServiceTitan Webhook

1. Go to ServiceTitan Developer Portal → My Apps
2. Edit your app → Add Webhook Events
3. Select `job.updated` event
4. Set callback URL: `https://YOUR_DOMAIN.com/webhook/servicetitan`
5. Copy the webhook secret to your `.env` file
6. Save and have tenant admin approve new app version

## Step 9: Setup Billing Alerts

1. DigitalOcean Dashboard → Settings → Billing
2. Add billing alert at $10 (well above your $6/month)
3. You'll get email if anything unexpected happens

## Step 10: Test Everything

```bash
# Check app is running
curl http://localhost:8000/health

# Check nginx is proxying
curl http://YOUR_DOMAIN.com/health

# Check HTTPS
curl https://YOUR_DOMAIN.com/health
```

Open in browser: `https://YOUR_DOMAIN.com`

## Maintenance Commands

```bash
# View logs
journalctl -u debrief-qa -f

# Restart app
systemctl restart debrief-qa

# Update code
cd /opt/debrief-qa
git pull
systemctl restart debrief-qa

# Backup database
cp /opt/debrief-qa/debrief.db /opt/debrief-qa/backups/debrief-$(date +%Y%m%d).db
```

## Troubleshooting

**App won't start:**
```bash
journalctl -u debrief-qa -n 50  # Check logs
```

**502 Bad Gateway:**
- Check if app is running: `systemctl status debrief-qa`
- Check port: `curl http://127.0.0.1:8000/health`

**Webhook not receiving:**
- Check nginx logs: `tail -f /var/log/nginx/access.log`
- Verify SSL: `curl -I https://YOUR_DOMAIN.com/webhook/servicetitan`
- Check ST developer portal for failed deliveries
