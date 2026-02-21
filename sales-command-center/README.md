# Christmas Air & Plumbing - Sales Dashboard

A comprehensive dashboard and sales tracker for tracking leads from generation through installation, with Service Titan integration and round-robin lead assignment.

## Features

- **Lead Pool Management**: Separate pools for Marketed leads and Tech Generated Leads (TGL)
- **Round-Robin Assignment**: Automatic fair distribution of leads to comfort advisors
- **Next In Line Tracking**: See who will receive the next lead for each type
- **Lead Flow Visualization**: Track leads through the entire sales pipeline
- **Service Titan Integration**: Sync leads with Service Titan API
- **Real-time Dashboard**: Monitor key metrics and lead status

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Service Titan API credentials (App Key, App Secret, Tenant ID)

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set up environment variables:
Create a `.env.local` file in the root directory:
```
NEXT_PUBLIC_SERVICE_TITAN_API_URL=https://api.servicetitan.com
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding Comfort Advisors

1. Navigate to the Admin page (to be added)
2. Add comfort advisors with their contact information
3. Set advisors as active/inactive as needed

### Adding Leads

Leads can be added in two ways:

1. **Manual Entry**: Use the lead entry form
2. **Service Titan Sync**: Automatically sync leads from Service Titan

### Lead Assignment

- Leads are automatically assigned using round-robin when you click "Assign Now"
- The system tracks who is next in line for each lead type (Marketed and TGL)
- Each lead type maintains its own round-robin rotation

### Tracking Lead Progress

Update lead status as it progresses through the pipeline:
- Generated → Assigned → Contacted → Quoted → Sold → Installed
- Lost leads can be marked as such

## Project Structure

```
christmas-air-dashboard/
├── app/
│   ├── api/              # API routes
│   ├── page.tsx          # Main dashboard
│   └── layout.tsx        # Root layout
├── components/           # React components
├── lib/                  # Service Titan integration
├── store/                # Zustand state management
├── types/                # TypeScript types
└── utils/                # Utility functions
```

## Service Titan Integration

The dashboard includes a Service Titan integration layer:

- **Authentication**: OAuth2 client credentials flow
- **Sync Leads**: Fetch leads from Service Titan
- **Create Leads**: Push new leads to Service Titan
- **Status Mapping**: Maps Service Titan job statuses to dashboard statuses

To configure Service Titan integration, you'll need:
- App Key
- App Secret
- Tenant ID

## Future Enhancements

- Database integration (currently uses in-memory storage)
- User authentication and role-based access
- Email notifications for new lead assignments
- Advanced reporting and analytics
- Mobile-responsive improvements
- Export functionality for reports

## License

Private - Christmas Air & Plumbing
