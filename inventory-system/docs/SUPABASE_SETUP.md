# Supabase Setup Guide

Follow these steps to provision the company Supabase project and run the schema migration.

---

## 1. Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in to your organization account
2. Click **New project**
3. Settings to use:
   - **Name:** `christmas-air-inventory` (or your preference)
   - **Database password:** Generate a strong password — save it somewhere safe
   - **Region:** `us-east-1` (closest to Lewisville, TX)
4. Wait 1–2 minutes for the project to provision

---

## 2. Get Your Connection String

1. In your Supabase project, go to **Settings → Database**
2. Scroll to **Connection string**
3. Select the **Pooler** tab (not "Direct connection")
4. Copy the **URI** — it looks like:
   ```
   postgresql://postgres.YOURPROJECTREF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you set in step 1

> **Use the pooler URL** (port 5432). The direct URL can hit Supabase's connection limits on the free tier.

---

## 3. Configure the API

In your `api/.env` file, set:

```
DATABASE_URL=postgresql://postgres.YOURPROJECTREF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<generate a random 40+ character string>
JWT_REFRESH_SECRET=<generate a different random 40+ character string>
```

Generate secrets quickly with:
```bash
node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
```
Run it twice — once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET`.

---

## 4. Run the Migration

From the `api/` folder:

```bash
node scripts/migrate.js
```

Expected output:
```
[migrate] Bootstrapping schema_migrations table...
[migrate] Running 001_schema.sql...
[migrate] ✅ 001_schema.sql applied
[migrate] All migrations complete.
```

This creates all 22 tables. The script is idempotent — safe to run multiple times.

---

## 5. Seed Development Data (optional but recommended)

```bash
node scripts/seed.js
```

This loads:
- 2 warehouses (Lewisville, Argyle)
- 6 trucks (P-01 through P-03, H-01 through H-03)
- 6 supply houses
- 7 users with hashed passwords
- 20 materials with stock levels
- 6 tools, 4 equipment items, 4 IT assets
- 6 sample ST jobs

**Skip this in production** — only use it for development/staging environments.

---

## 6. Verify the Setup

Start the API and hit the health endpoint:
```bash
cd api && npm run dev
# In another terminal:
curl http://localhost:3100/health
# Expected: {"status":"ok","env":"development","ts":"..."}
```

Then try logging in:
```bash
curl -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@christmasair.com","password":"admin123"}'
```

---

## 7. Supabase Row Level Security (RLS)

The current schema does **not** use Supabase's Row Level Security — all access control happens in the Express API layer via JWT + `requireRole()` middleware. This is intentional.

If you later want to enable RLS (e.g. for direct Supabase client access from the frontend), add policies for each table. For now, keep the service role key server-side only and do not expose it to the browser.

---

## 8. Environment Variables for Each Team Member

Each developer needs their own `api/.env` with the shared Supabase DATABASE_URL. The JWT secrets should be shared (or each dev can use their own for dev — tokens from one won't work against another's secret).

**Recommended:** Store the shared dev secrets in your password manager (1Password, Bitwarden, etc.) and share them with the team out-of-band. Do not commit `.env` to git.

---

## Production vs Development

| | Development | Production |
|---|---|---|
| DATABASE_URL | Supabase dev project | Supabase prod project (separate) |
| Seed data | Run `seed.js` | Do NOT seed |
| NODE_ENV | development | production |
| JWT_EXPIRES_IN | 15m (default) | 15m |
| CORS_ORIGINS | http://localhost:5173 | https://your-app-domain.com |
