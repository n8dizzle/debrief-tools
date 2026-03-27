# CLAUDE.md - Homework Home Services Marketplace

## Development Rules (Read First)

**TEST AT 375px BEFORE DESKTOP.** Every component, every change. If it doesn't work on mobile, it doesn't ship.

**THE INPUT FIELD NEVER DISAPPEARS.** This is the #1 rule of the consumer UI. The chat input is always visible, always functional.

**ONE COMPONENT, ONE EXPERIENCE.** Never build separate mobile/desktop versions. Build mobile-first, enhance up.

---

## CRITICAL: Timezone Rules

**This marketplace operates in TEXAS (Central Time). All dates MUST be in Central Time, not UTC.**

### NEVER DO THIS:
```typescript
const dateStr = new Date().toISOString().split('T')[0]; // WRONG - UTC conversion
```

### ALWAYS DO THIS:
```typescript
import { formatLocalDate } from '@homework/shared/utils';
const dateStr = formatLocalDate(new Date()); // CORRECT - local timezone
```

---

## Project Overview

**Homework** is a transparent transaction engine for homeownership — helping homeowners understand their home, see what work matters, and buy services with confidence. MVP launching closed beta in Dallas-Fort Worth.

**Core philosophy**: Transparency over optimization. Confidence over speed. Trust over extraction. When in doubt, ask: "Does this increase homeowner confidence?"

## Architecture

| App | URL | Port | Purpose |
|-----|-----|------|---------|
| Consumer | app.homework.com | 3100 | Conversational AI marketplace |
| Contractor | pro.homework.com | 3101 | Price Book, orders, availability, payouts |
| Admin | admin.homework.com | 3102 | Catalog management, contractor approvals |
| Marketing | homework.com | 3103 | Landing pages, SEO, conversion |

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: Supabase (Postgres with RLS)
- **Auth**: Supabase Auth (Google OAuth + email)
- **Storage**: Cloudflare R2 (zero egress fees for photos)
- **Payments**: Stripe Connect (Express accounts)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (consumer flow state)
- **AI**: Google Gemini (chat, equipment scanning) + Claude (PDF parsing)
- **Property Data**: Rentcast API
- **Maps**: Google Maps Platform
- **Deployment**: Vercel

## Monorepo Structure

```
homework/
├── packages/shared/          # @homework/shared
│   ├── lib/types.ts          # All TypeScript types (85+ marketplace + flow types)
│   ├── lib/auth.ts           # Supabase SSR auth helpers
│   ├── lib/catalog.ts        # Price calc, HomeFit, search
│   ├── lib/geo.ts            # Haversine, DFW market, zip
│   ├── lib/ai/gemini.ts      # Gemini chat engine
│   ├── lib/ai/equipment.ts   # Photo scanning
│   ├── lib/property-data.ts  # Rentcast enrichment
│   ├── utils/format.ts       # Currency (cents), dates, phone, ratings
│   └── components/ui/        # Shared shadcn/ui components
├── apps/
│   ├── consumer/             # Conversational marketplace (from hw-mvp-web-app)
│   ├── contractor/           # Pro portal (shadcn/ui)
│   ├── admin/                # Platform admin (shadcn/ui)
│   └── marketing/            # Static marketing site
└── supabase/migrations/      # Combined schema
```

## Shared Package (@homework/shared)

```typescript
import { ... } from '@homework/shared/types';
import { ... } from '@homework/shared/auth';
import { ... } from '@homework/shared/catalog';
import { ... } from '@homework/shared/geo';
import { ... } from '@homework/shared/utils';
import { ... } from '@homework/shared/components';
```

## Development Commands

```bash
# Install all workspaces
npm install

# Start individual apps
npm run dev:consumer     # http://localhost:3100
npm run dev:contractor   # http://localhost:3101
npm run dev:admin        # http://localhost:3102
npm run dev:marketing    # http://localhost:3103

# Build
npm run build:consumer
npm run build:contractor

# Supabase
npx supabase db push
npx supabase gen types typescript --local > packages/shared/lib/database.ts
```

## Database (Supabase)

Supabase project: `wwshcwlkilsxczfyelig`

### Key Tables
- `user_profiles` - extends auth.users (role: homeowner/contractor/admin)
- `catalog_departments/categories/services` - Master Catalog (100 services)
- `catalog_service_variables/addons` - Configurator options
- `contractors` - Business profiles + Stripe Connect
- `contractor_prices` - Prices per catalog service
- `homes` - Property profiles + Rentcast data
- `home_features` - Boolean attributes for HomeFit matching
- `hvac_systems` - HVAC system details
- `equipment` - Equipment tracking with photo scanning
- `orders/order_items` - Marketplace transactions
- `reviews` - 5-dimension ratings

### RLS Strategy
- Homeowners see only their own data
- Contractors see their data + assigned orders
- Catalog is public read
- Admin uses service_role key server-side

## Key Concepts

### Master Catalog
100 standardized services across 3 departments:
- THE LOT (30): Lawn, landscaping, fencing, driveways, pool
- THE EXTERIOR (25): Roofing, siding, windows/doors, foundation, gutters
- THE INTERIOR (45): HVAC, plumbing, electrical, finishes, appliances, pest

### HomeFit
Rules engine matching services to homes. Each service has `homefit_rules` JSONB.

### Pricing Model
- Contractors set prices against standardized catalog service scopes
- Consumers compare identical scopes across contractors
- Money stored in cents (integers) everywhere
- Platform take rate: 5-50% per transaction

## Auth Pattern (Supabase Auth - NOT NextAuth)

```typescript
// Browser client
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(url, anonKey);

// Server client (API routes, server components)
import { createServerClient } from '@supabase/ssr';
// Uses cookies for session management
```

## Security Rules (Non-Negotiable)

1. Never put secrets in client components (no `NEXT_PUBLIC_` prefix for secrets)
2. Always use RLS on Supabase tables
3. Always validate auth before data access
4. Use Stripe webhooks for payment confirmation, never client callbacks
5. Never expose contractor pricing to other contractors
6. Never expose homeowner contact info to non-matched contractors

## Naming Conventions

- **Files/folders**: `kebab-case` (e.g., `equipment-card.tsx`, `use-home-data.ts`)
- **TypeScript**: `PascalCase` for types, `camelCase` for variables/functions
- **Database**: `snake_case` for tables/columns, plural table names, FKs as `home_id`

## Terminology (Use Exactly)

| Term | Definition | Never Call It |
|------|------------|---------------|
| Homework | The platform | "the app", "the site" |
| HomeFit | Home data/health layer | "home profile" |
| Professional / Pro | Service provider | "vendor", "contractor" (externally) |
| Homeowner | Primary customer | "user", "customer" |

## Copy Guidelines

- Plainspoken, calm, confident tone
- No exclamation points in UI copy
- Never use: "Get quotes fast", "Lowest price guaranteed", "Compare bids", "Limited time"
- Do use: "Start a project", "View solutions", "See pricing", "Book service"

## Environment Variables

### All Apps
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Consumer
```
GOOGLE_GENERATIVE_AI_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
NEXT_PUBLIC_RENTCAST_API_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
```

### Contractor
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANTHROPIC_API_KEY          # PDF parsing
```

---

## Conversational UI Architecture (Consumer App)

The consumer app feels like **texting**, not a form wizard. Users accomplish tasks through dialogue.

### The Golden Rule

**The input field never disappears.** Ever. Not during loading. Not after auth. Not during checkout.

### Chips Are Shortcuts, Not Gates

Quick reply chips **accelerate** common paths. They do not **replace** typing.

### Everything Inline

Everything stays in the conversation: property cards, pro cards, pricing options, scheduling, checkout. **Never** navigate to a separate page mid-flow. **Never** use modals for data collection.

### The Phone Test

For every screen, ask: "Can someone use this one-handed on a phone while standing in their backyard looking at their AC unit?"

---

## Mobile-First UI (Non-Negotiable)

Design for 375px first, scale UP to desktop.

### Touch Targets
- Minimum 44x44px for all interactive elements
- 8px minimum spacing between tap targets
- No hover-only interactions

### Breakpoints (Tailwind)
```
Default = mobile (no prefix)
sm: 640px = tablet
lg: 1024px = desktop
```

## Related Documentation

- `DESIGN-SYSTEM.md` - Colors, typography, components, spacing
- `apps/consumer/` - Consumer app with conversational flow
- `packages/shared/` - Shared types, utils, catalog logic
