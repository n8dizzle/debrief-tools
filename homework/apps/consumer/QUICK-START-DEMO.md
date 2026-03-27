# Quick Start: Demo Home with Real Rentcast Data

## 📋 Checklist

- [ ] Get Rentcast API key
- [ ] Add API key to `.env.local`
- [ ] Get Supabase Service Role key
- [ ] Add Service Role key to `.env.local`
- [ ] Get your user ID (or create demo user)
- [ ] Update `DEMO_USER_ID` in seed script
- [ ] Install dependencies
- [ ] Run the script!

---

## 1️⃣ Get Rentcast API Key

1. Go to [app.rentcast.io/app/api](https://app.rentcast.io/app/api)
2. Sign in or create account
3. Click "Create API Key"
4. Copy your key

---

## 2️⃣ Get Supabase Service Role Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Settings** → **API**
4. Copy the `service_role` **secret** key

⚠️ **Important**: This is different from the `anon` key. Never expose the service role key to the browser!

---

## 3️⃣ Add to `.env.local`

Add these two lines to your `.env.local` file:

```bash
NEXT_PUBLIC_RENTCAST_API_KEY=your_rentcast_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Your complete `.env.local` should look like:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # ← ADD THIS

# Rentcast
NEXT_PUBLIC_RENTCAST_API_KEY=your_key_here  # ← ADD THIS

# Google Maps (should already exist)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Mapbox (should already exist)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

---

## 4️⃣ Get Your User ID

**Option A: Use existing user**
1. Sign up at `/login` in your app
2. Go to Supabase Dashboard → **Authentication** → **Users**
3. Copy your UUID

**Option B: Create demo user in Supabase SQL Editor**

```sql
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@example.com',
  crypt('demodemo123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
);
```

Then use: `00000000-0000-0000-0000-000000000001`

---

## 5️⃣ Update the Script

Edit `scripts/seed-demo-home.ts` (line 14):

```typescript
const DEMO_USER_ID = "your-user-uuid-here"  // ← CHANGE THIS
```

---

## 6️⃣ Install Dependencies

```bash
npm install
```

---

## 7️⃣ Run the Script!

```bash
# Default address (White House)
npm run seed-demo-home

# Or use your own address
npm run seed-demo-home -- "123 Main St, City, State ZIP"
```

---

## 🎉 What You'll Get

The script will:
- ✅ Fetch **real property data** from Rentcast
- 📊 Display all the JSON data
- 💾 Save it to your `homes` table
- 📋 Show a summary of key fields
- 💡 Suggest "moments of delight" ideas

Example output:
```
✅ Real data fetched from Rentcast API

📊 Property Data Retrieved:
{
  "propertyType": "Single Family",
  "yearBuilt": 2005,
  "sqft": 2850,
  "beds": 4,
  "baths": 3,
  "pool": true,
  "fireplace": true,
  "lastSalePrice": 450000,
  "taxAssessedValue": 425000,
  ...50+ more fields
}

💾 Saving to database...
✅ Demo home created successfully!

💡 Potential 'Moments of Delight' from this data:
   • "Your home is 19 years old, built in 2005"
   • "Your home has appreciated 23.5% since you bought it"
   • "Great news! Your home has a pool 🏊"
```

---

## 🔍 Explore the Data

After running:

1. **Supabase Dashboard**: Table Editor → `homes` → find your property
2. **Your App**: Login and go to `/dashboard`
3. **SQL Queries**: Experiment with the data

---

## 💡 Ideas for "Moments of Delight"

With this rich data, you can create:

- 🏠 "Your {year_built} home has seen {years} years of memories"
- 💰 "Your home value increased {percent}% since purchase"
- 🏊 "Homes with pools in {county} sell for {percent}% more"
- 🔥 "Original fireplace from {year_built} - built to last!"
- 📊 "Your {sqft} sq ft is {comparison} for {subdivision}"
- 🏡 "{property_type} homes in {city} average ${avg_price}"

---

## 📚 More Help

See `DEMO-HOME-SETUP.md` for detailed troubleshooting and examples.

---

**You're all set! This will give you real data to explore and build amazing features with! 🚀**

