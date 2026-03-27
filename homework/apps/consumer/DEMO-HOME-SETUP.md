# Demo Home Setup Guide

This guide will help you create a demo home with real Rentcast data so you can explore what property data is available and experiment with "moments of delight."

---

## Prerequisites

You need the following API keys and credentials:

### 1. Rentcast API Key

Get your free API key from Rentcast:
1. Go to [app.rentcast.io/app/api](https://app.rentcast.io/app/api)
2. Sign in or create an account
3. Click "Create API Key"
4. Copy your API key

### 2. Supabase Service Role Key

Get your Supabase service role key:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **service_role** secret key (NOT the anon key)

⚠️ **Important**: The service role key bypasses Row Level Security and should NEVER be exposed to the client. Only use it in server-side scripts.

---

## Setup Steps

### Step 1: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Rentcast API Key (for fetching real property data)
NEXT_PUBLIC_RENTCAST_API_KEY=your_rentcast_api_key_here

# Supabase Service Role Key (for database access in scripts)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# These should already exist:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

### Step 2: Get a Real User ID

The demo home needs to be associated with a user. You have two options:

**Option A: Use Your Own User (Recommended)**
1. Sign up in your app (go to `/login`)
2. Get your user ID from Supabase Dashboard:
   - Go to **Authentication** → **Users**
   - Copy your user's UUID

**Option B: Create a Demo User via SQL**
Run this in your Supabase SQL Editor:

```sql
-- Create a demo user (password: demodemo123)
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

### Step 3: Update the Script

Edit `scripts/seed-demo-home.ts` and replace the `DEMO_USER_ID`:

```typescript
// Replace this with your actual user UUID
const DEMO_USER_ID = "your-user-id-here"
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Run the Script

**Default demo address (White House):**
```bash
npm run seed-demo-home
```

**Custom address:**
```bash
npm run seed-demo-home -- "742 Evergreen Terrace, Springfield, OR 97477"
```

---

## What You'll See

The script will:

1. ✅ Fetch property data from Rentcast API
2. 📊 Display all the data that was retrieved (JSON format)
3. 💾 Save the complete property record to your database
4. 📋 Show a summary of key fields
5. 💡 Suggest "moments of delight" based on the data

**Example Output:**

```
🏡 Demo Home Seeder

📍 Fetching property data for: 1600 Pennsylvania Avenue NW, Washington, DC 20500

⏳ Fetching data from Rentcast API...

✅ Real data fetched from Rentcast API

📊 Property Data Retrieved:

{
  "rentcastId": "1600-Pennsylvania-Avenue-NW-Washington-DC-20500",
  "propertyType": "Single Family",
  "formattedAddress": "1600 Pennsylvania Ave NW, Washington, DC 20500",
  "yearBuilt": 1792,
  "sqft": 55000,
  "beds": 16,
  "baths": 35,
  "lotSizeSqft": 18700000,
  "pool": true,
  "fireplace": true,
  ...
}

💾 Saving to database...

✅ Demo home created successfully!

📝 Database Record ID: abc-123-def-456

📋 Summary of saved data:

   Address: 1600 Pennsylvania Ave NW, Washington, DC 20500
   Property Type: Single Family
   Year Built: 1792
   Bedrooms: 16
   Bathrooms: 35
   Square Feet: 55,000
   ...

💡 Potential 'Moments of Delight' from this data:

   • "Your home is 232 years old, built in 1792"
   • "Your home has appreciated 157.3% since you bought it"
   • "Welcome to President's Park in District of Columbia County!"
   • "Great news! Your home has a pool 🏊"
   • "Your annual property taxes are $1,200"
```

---

## Exploring the Data

After running the script, you can:

### 1. View in Supabase Dashboard
- Go to **Table Editor** → **homes**
- Find your demo home by the address
- Explore all 60+ fields of data

### 2. Query the Data
Run queries in Supabase SQL Editor:

```sql
-- See all demo home data
SELECT * FROM homes 
WHERE street_address LIKE '%Pennsylvania%';

-- Check what features are available
SELECT 
  formatted_address,
  property_type,
  year_built,
  pool,
  fireplace,
  garage_spaces,
  estimated_value,
  last_sale_price
FROM homes
WHERE user_id = 'your-user-id';
```

### 3. Use in Your App
- Log in with your user account
- Navigate to `/dashboard`
- You should see the demo home in your account

---

## Troubleshooting

### "Missing Supabase credentials"
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in `.env.local`

### "Using mock data"
- Your Rentcast API key is missing or invalid
- Check `NEXT_PUBLIC_RENTCAST_API_KEY` in `.env.local`

### "Error saving to database"
- Check that your `DEMO_USER_ID` exists in `auth.users` table
- Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct

### "Address not found"
- Try a different, more well-known address
- Some addresses may not be in Rentcast's database
- The script will still save mock data if real data isn't available

---

## Example Addresses to Try

Here are some interesting addresses with rich property data:

```bash
# Famous homes
npm run seed-demo-home -- "1600 Pennsylvania Avenue NW, Washington, DC 20500"
npm run seed-demo-home -- "1 Infinite Loop, Cupertino, CA 95014"
npm run seed-demo-home -- "221B Baker Street, London, UK"

# Your own home
npm run seed-demo-home -- "YOUR ADDRESS HERE"
```

---

## Next Steps

Once you have demo data:

1. **Explore the database** - See what fields have data
2. **Design UI features** - Use the data for personalization
3. **Create insights** - Build "moments of delight"
4. **Test edge cases** - See what happens with missing data

Examples of insights you can build:
- Home age and historical context
- Appreciation since purchase
- Tax comparisons
- Feature highlights (pool, fireplace, etc.)
- Neighborhood info
- Energy efficiency suggestions based on age/features

---

## Clean Up

To remove demo homes:

```sql
-- Remove all homes for demo user
DELETE FROM homes WHERE user_id = 'your-demo-user-id';

-- Or remove specific home
DELETE FROM homes WHERE id = 'home-id-from-script-output';
```

---

**Happy exploring! 🏡✨**

