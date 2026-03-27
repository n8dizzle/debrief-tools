# Required Environment Variables

Add these to your `.env.local` file to use the demo home seeder.

## What to Add

```bash
# ===== ADD THESE TWO LINES =====

# Rentcast API Key (get from: https://app.rentcast.io/app/api)
NEXT_PUBLIC_RENTCAST_API_KEY=your_rentcast_api_key_here

# Supabase Service Role Key (get from: Supabase Dashboard → Settings → API)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Your Complete `.env.local` Should Look Like:

```bash
# Supabase (these should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# ⚠️ ADD THIS - Service Role Key (for server-side scripts only)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Google Maps (should already exist)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Mapbox (should already exist)  
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# ✨ ADD THIS - Rentcast API Key
NEXT_PUBLIC_RENTCAST_API_KEY=your_rentcast_key_here
```

## Where to Get Each Key

| Key | Where to Get It |
|-----|-----------------|
| `NEXT_PUBLIC_RENTCAST_API_KEY` | [app.rentcast.io/app/api](https://app.rentcast.io/app/api) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` secret |

## Important Notes

- ⚠️ **Never commit `.env.local` to git** - it's already in `.gitignore`
- ⚠️ **Service Role Key is secret** - never expose to browser/client
- ✅ After adding keys, restart your dev server: `npm run dev`

## Next Steps

After adding these keys:
1. Run `npm install` (installs `tsx` dependency)
2. Update `DEMO_USER_ID` in `scripts/seed-demo-home.ts`
3. Run `npm run seed-demo-home`

See `QUICK-START-DEMO.md` for complete instructions!

