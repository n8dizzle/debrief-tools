# Quick Start Guide

## Installation Steps

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/ (version 18 or higher)
   - Verify installation: `node --version` and `npm --version`

2. **Install Dependencies**
   ```bash
   cd /Users/scotttitensor/christmas-air-dashboard
   npm install
   ```

3. **Set Up Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Service Titan credentials if available.

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   - Navigate to http://localhost:3000
   - Click "Admin Panel" to add advisors and leads
   - Or click "Load Sample Data" in the admin panel to see example data

## Key Features

### Dashboard (`/`)
- View all leads and their status
- See lead pools for Marketed and TGL leads
- Track who is next in line for each lead type
- View lead flow charts and statistics
- Filter leads by type (All, Marketed, TGL)

### Admin Panel (`/admin`)
- Add/Manage Comfort Advisors
- Add new leads manually
- Load sample data for testing

### Round-Robin Assignment
- Each lead type (Marketed and TGL) has its own round-robin rotation
- When you click "Assign Now" on a lead, it automatically assigns to the next advisor in rotation
- The "Next In Line" widgets show who will receive the next lead

### Lead Status Flow
1. **Generated** - Lead created, not yet assigned
2. **Assigned** - Assigned to a comfort advisor
3. **Contacted** - Advisor has contacted the customer
4. **Quoted** - Quote has been provided
5. **Sold** - Sale completed
6. **Installed** - Installation completed
7. **Lost** - Lead lost/cancelled

## Service Titan Integration

To integrate with Service Titan:

1. Get your Service Titan API credentials:
   - App Key
   - App Secret
   - Tenant ID

2. Configure in `.env.local`:
   ```
   SERVICE_TITAN_APP_KEY=your_key
   SERVICE_TITAN_APP_SECRET=your_secret
   SERVICE_TITAN_TENANT_ID=your_tenant_id
   ```

3. Use the API endpoint `/api/servicetitan` to sync leads

## Troubleshooting

- **Port 3000 already in use**: Change the port with `PORT=3001 npm run dev`
- **Module not found errors**: Run `npm install` again
- **TypeScript errors**: Ensure you're using Node.js 18+ and run `npm install`

## Next Steps

- Set up a database (PostgreSQL, MongoDB, etc.) for persistent storage
- Add user authentication
- Configure Service Titan webhooks for automatic lead sync
- Add email notifications for new assignments
- Customize branding and colors
