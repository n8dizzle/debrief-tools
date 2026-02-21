# CLAUDE.MD - Christmas Air & Plumbing Dashboard

## Project Overview

This is a **lead tracking and sales dashboard** for Christmas Air & Plumbing. It manages leads from generation through installation, with round-robin assignment to comfort advisors and Service Titan integration.

**Tech Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, Recharts

## Key Architecture Decisions

### State Management (Zustand)
- **Single source of truth**: `store/dashboardStore.ts`
- **In-memory storage**: Currently no database (resets on restart)
- All state mutations happen through store actions
- Store manages: leads, advisors, lead pools, round-robin indices

### Round-Robin Assignment System
- **Independent rotation per lead type**: Marketed vs Tech Generated Leads (TGL)
- Each type tracks its own `currentIndex` in the store
- Algorithm: `activeAdvisors[currentIndex % advisorCount]`
- `getNextInLine()` previews next advisor without incrementing
- Index increments only on actual assignment

### Lead Lifecycle
```
Generated → [Pool] → Assigned → Contacted → Quoted → Sold → Installed
                  ↓
                Lost (at any stage)
```

## Critical Files & Their Roles

### `/store/dashboardStore.ts` (Core State)
- **Main state management**: All leads, advisors, pools, indices
- **Key methods**:
  - `assignLead(leadId)`: Assigns lead using round-robin
  - `getNextInLine(type)`: Shows who gets next lead
  - `updateLeadStatus()`: Moves leads through pipeline
  - `addComfortAdvisor()`: Manages advisor roster
- **Lead pools**: Separate arrays for unassigned Marketed and TGL leads

### `/app/page.tsx` (Main Dashboard)
- Statistics cards (total leads, conversion rate, pipeline value)
- Lead flow visualization chart
- Comprehensive lead table with filtering
- Lead pool displays
- Next-in-line widgets for both lead types

### `/app/admin/page.tsx` (Admin Panel)
- Add/edit comfort advisors
- Manual lead entry form
- Sample data loader for testing
- Advisor management (active/inactive toggle)

### `/components/` (UI Components)
- `LeadFlowChart.tsx`: Bar chart showing lead distribution by status
- `LeadPoolCard.tsx`: Displays unassigned leads in each pool
- `LeadTable.tsx`: Sortable/filterable table with status updates
- `NextInLineWidget.tsx`: Shows next advisor for lead type
- `StatsCards.tsx`: Key metrics display

### `/lib/serviceTitan.ts` (External Integration)
- Service Titan API client with OAuth2
- Lead sync and status mapping
- **Requires env vars**: App Key, App Secret, Tenant ID
- Currently stubbed out (needs actual credentials)

### `/types/index.ts` (TypeScript Definitions)
```typescript
Lead: id, source, type, status, customer info, advisor, timestamps
ComfortAdvisor: id, name, email, phone, active status
LeadType: 'Marketed' | 'TGL'
LeadStatus: 'generated' | 'assigned' | 'contacted' | 'quoted' | 'sold' | 'installed' | 'lost'
```

## Important Patterns & Conventions

### Adding New Features
1. Define types in `/types/index.ts` first
2. Add state/actions to Zustand store if needed
3. Create component in `/components/` if reusable
4. Import and use in pages (`/app/`)

### Lead Assignment Flow
```typescript
1. User clicks "Assign Now" on lead
2. LeadTable calls store.assignLead(leadId)
3. Store:
   - Gets next advisor via round-robin
   - Updates lead with advisorId
   - Removes from pool
   - Increments currentIndex for that type
4. UI re-renders showing assignment
```

### Environment Variables
- `.env.local` (gitignored): Add Service Titan credentials
- `.env.example`: Template for required variables
- Access via `process.env.NEXT_PUBLIC_*` for client-side

## Common Tasks

### Adding a New Lead Status
1. Update `LeadStatus` type in `/types/index.ts`
2. Add to status mapping in `/lib/serviceTitan.ts` if needed
3. Update UI dropdowns in `LeadTable.tsx`
4. Add chart color in `LeadFlowChart.tsx`

### Adding a New Lead Type
1. Update `LeadType` type in `/types/index.ts`
2. Add new pool array in store state
3. Add new `currentIndex` for round-robin
4. Update `assignLead()` logic to handle new type
5. Add UI widgets (pool card, next-in-line)

### Database Integration (Future)
Current state is in-memory. To add persistence:
1. Choose DB (PostgreSQL, MongoDB, etc.)
2. Create schema matching TypeScript types
3. Replace store methods with API calls
4. Add API routes in `/app/api/`
5. Keep Zustand for client-side state only

## Development Workflow

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
# → http://localhost:3000

# Build for production
npm run build
npm start

# Lint
npm run lint
```

## Testing the Application

1. Go to `/admin` and click "Load Sample Data"
2. Add comfort advisors via form
3. View dashboard at `/`
4. Click "Assign Now" on unassigned leads
5. Update lead statuses through pipeline
6. Watch statistics and charts update

## Known Limitations

- **No persistence**: Data resets on server restart
- **No authentication**: Anyone can access all pages
- **No real-time updates**: Requires manual refresh
- **Service Titan**: Integration stubbed but not fully implemented
- **No validation**: Limited form validation on inputs
- **No error handling**: Basic error states only

## Service Titan Integration Notes

The Service Titan integration layer exists but requires:
- Valid API credentials (App Key, App Secret, Tenant ID)
- OAuth2 token management
- Webhook setup for real-time sync
- Status mapping configuration

Files: `/lib/serviceTitan.ts`, `/app/api/servicetitan/route.ts`

## Future Enhancement Ideas

From PROJECT_SUMMARY.md:
- Database integration (PostgreSQL/Supabase recommended)
- User authentication (NextAuth.js)
- Email/SMS notifications for assignments
- Lead scoring system
- Per-advisor performance analytics
- Custom report builder
- Export to CSV/PDF
- Mobile app or PWA

## File Structure Reference

```
christmas-air-dashboard/
├── app/
│   ├── admin/page.tsx              # Admin panel
│   ├── api/
│   │   ├── leads/route.ts         # Leads CRUD API
│   │   └── servicetitan/route.ts  # Service Titan sync
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   ├── LeadFlowChart.tsx          # Recharts bar chart
│   ├── LeadPoolCard.tsx           # Unassigned lead display
│   ├── LeadTable.tsx              # Main lead table
│   ├── NextInLineWidget.tsx       # Round-robin preview
│   └── StatsCards.tsx             # Dashboard metrics
├── lib/
│   ├── serviceTitan.ts            # Service Titan API client
│   └── sampleData.ts              # Test data generator
├── store/
│   └── dashboardStore.ts          # Zustand state store
├── types/
│   └── index.ts                   # TypeScript types
└── utils/
    └── leadUtils.ts               # Helper functions
```

## Quick Reference Commands

```typescript
// Get next advisor for lead type
const nextAdvisor = dashboardStore.getNextInLine('Marketed');

// Assign lead
dashboardStore.assignLead(leadId);

// Update lead status
dashboardStore.updateLeadStatus(leadId, 'contacted');

// Add advisor
dashboardStore.addComfortAdvisor({
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234"
});

// Get unassigned leads by type
const marketedPool = dashboardStore.marketedLeadPool;
const tglPool = dashboardStore.tglLeadPool;
```

## Important Notes for AI Assistants

1. **State is in-memory**: Changes don't persist across restarts
2. **Round-robin is type-specific**: Marketed and TGL have separate rotations
3. **No user auth**: All operations are currently unauthenticated
4. **Sample data available**: Use "Load Sample Data" in admin for testing
5. **TypeScript strict mode**: All types must be properly defined
6. **Tailwind for styling**: No custom CSS classes, use Tailwind utilities
7. **Client components**: Most components use 'use client' for interactivity

## Contact & Context

- **Company**: Christmas Air & Plumbing
- **Purpose**: Internal sales lead tracking
- **Users**: Comfort advisors and office staff
- **Scale**: Small team (likely < 20 advisors)
- **Environment**: Next.js development (not production-ready yet)
