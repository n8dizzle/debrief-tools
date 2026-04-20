# Deployment Status - Christmas Air Internal Tools

Last Updated: April 20, 2026

## All Apps - Vercel

Every app deploys to Vercel. See CLAUDE.md for the full app table and deploy commands.

| App | URL |
|-----|-----|
| That's a Wrap | https://debrief.christmasair.com |
| Daily Dash | https://dash.christmasair.com |
| Marketing Hub | https://marketing.christmasair.com |
| Internal Portal | https://portal.christmasair.com |
| AR Collections | https://ar.christmasair.com |
| Job Tracker | https://track.christmasair.com |
| AP Payments | https://ap.christmasair.com |
| Membership Manager | https://memberships.christmasair.com |
| Doc Dispatch | https://docs.christmasair.com |
| Referrals | https://refer.christmasair.com |

## DNS (Namecheap)

All subdomains are CNAME records pointing to Vercel.

## GitHub

- **URL**: https://github.com/n8dizzle/debrief-tools
- **Visibility**: Private

## History

- **2026-04-20**: Referrals Sprint 7 — QA fixes to enrollment flow + new `ref_settings` runtime config store (admin settings page gated on `referrals.can_manage_settings`).
- **2026-04-17**: Migrated debrief-qa from DigitalOcean droplet to Vercel. Droplet destroyed.
- **2026-01-04**: Initial deployment of debrief-qa to DigitalOcean.
