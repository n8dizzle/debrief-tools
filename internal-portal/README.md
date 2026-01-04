# Christmas AC Internal Tools Portal

A simple internal portal for accessing all company tools and resources, protected by Google OAuth.

## Features

- 🔐 Google OAuth login (restricted to company domain)
- 📱 Responsive design
- 🎯 Tool cards with categories
- ⚡ Quick links section
- 🚀 Deploy to Vercel in minutes

## Quick Start

### 1. Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth Client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://portal.yourdomain.com/api/auth/callback/google` (production)
7. Copy the **Client ID** and **Client Secret**

### 2. Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your credentials
# - Add your GOOGLE_CLIENT_ID
# - Add your GOOGLE_CLIENT_SECRET  
# - Generate NEXTAUTH_SECRET: openssl rand -base64 32
# - Set ALLOWED_EMAIL_DOMAINS to your company domain(s)

# Run development server
npm run dev

# Open http://localhost:3000
```

### 3. Deploy to Vercel

1. Push code to GitHub
2. Go to [Vercel](https://vercel.com) and import the repo
3. Add environment variables in Vercel dashboard:
   - `NEXTAUTH_URL` = `https://portal.yourdomain.com`
   - `NEXTAUTH_SECRET` = your generated secret
   - `GOOGLE_CLIENT_ID` = your Google client ID
   - `GOOGLE_CLIENT_SECRET` = your Google client secret
   - `ALLOWED_EMAIL_DOMAINS` = `christmasac.com,bartsheating.com`
4. Deploy!
5. Update Google Cloud Console with production callback URL

## Configuration

### Adding/Editing Tools

Edit the `tools` and `resources` arrays in `app/page.tsx`:

```typescript
const tools = [
  {
    name: "Tool Name",
    description: "What it does",
    url: "https://tool.url.com",
    icon: "📋",  // Emoji icon
    category: "Operations",
  },
  // ... more tools
];
```

### Restricting Email Domains

Set the `ALLOWED_EMAIL_DOMAINS` environment variable:

```
ALLOWED_EMAIL_DOMAINS=christmasac.com,bartsheating.com
```

Users with emails outside these domains will see "Access Denied" when trying to sign in.

## Project Structure

```
internal-portal/
├── app/
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth config
│   ├── login/page.tsx                    # Login page
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Main portal page
│   └── globals.css                       # Global styles
├── components/
│   ├── AuthProvider.tsx                  # Session provider
│   └── ToolCard.tsx                      # Tool card component
├── middleware.ts                         # Route protection
├── .env.example                          # Environment template
└── package.json
```

## Customization

### Branding

- Update the logo/emoji in `app/page.tsx` and `app/login/page.tsx`
- Modify company name in the header and footer
- Update support email address

### Styling

The portal uses Tailwind CSS. Edit classes directly in the components or modify `tailwind.config.js` for theme customization.

## Troubleshooting

### "Access Denied" Error

- Verify email domain is in `ALLOWED_EMAIL_DOMAINS`
- Check for typos in domain names
- Clear browser cookies and try again

### Google OAuth Not Working

- Verify redirect URIs in Google Cloud Console match exactly
- Ensure OAuth consent screen is configured
- Check that APIs are enabled

### Vercel Deployment Issues

- Verify all environment variables are set in Vercel dashboard
- Check `NEXTAUTH_URL` matches your actual domain
- Redeploy after changing environment variables
