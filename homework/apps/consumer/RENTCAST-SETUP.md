# Rentcast.io Integration Setup

This app uses [Rentcast.io](https://www.rentcast.io) to fetch real property data for addresses.

## Quick Setup

### 1. Get Your API Key

1. Go to [app.rentcast.io](https://app.rentcast.io/app/api)
2. Sign in to your account
3. Click "Create API Key" to generate your key
4. Copy your API key

### 2. Add to Environment Variables

Add this to your `.env.local` file:

```bash
NEXT_PUBLIC_RENTCAST_API_KEY=your_rentcast_api_key_here
```

### 3. Restart Dev Server

```bash
npm run dev
```

## What Data We Fetch

The integration retrieves:
- **Year Built** - Construction year
- **Square Footage** - Living area size
- **Bedrooms** - Number of bedrooms
- **Bathrooms** - Number of bathrooms
- **Lot Size** - Property lot size in sqft (converted to acres for display)
- **Property Type** - Single family, condo, etc.

## API Endpoint Used

```
GET https://api.rentcast.io/v1/properties
```

**Query Parameters:**
- `address` - Street address
- `city` - City name (parsed from formatted address)
- `state` - State code (parsed from formatted address)
- `zipCode` - ZIP code (parsed from formatted address)

**Headers:**
- `Accept: application/json`
- `X-Api-Key: your_api_key`

## Pricing

Rentcast offers:
- **Free Developer Plan**: 50 API requests/month
- **Paid Plans**: Various tiers for higher usage

[View Pricing Plans →](https://developers.rentcast.io/reference/billing-and-pricing)

## Fallback Behavior

If no API key is configured or the API fails:
- App automatically generates **mock data** based on address hash
- Mock data is consistent for the same address
- UI shows "(sample data)" label when using mock data

## Documentation

- [Rentcast API Docs](https://developers.rentcast.io/)
- [Property Data Endpoint](https://developers.rentcast.io/reference/property-records)

## Troubleshooting

### No data showing up?

1. Check browser console for errors
2. Verify API key is correct in `.env.local`
3. Ensure dev server was restarted after adding the key
4. Check Rentcast API usage limits

### Getting 401 errors?

- Your API key may be invalid or expired
- Check your [Rentcast dashboard](https://app.rentcast.io/app/api)

### Getting 429 errors?

- You've hit your monthly API request limit
- Upgrade your plan or wait for the monthly reset

