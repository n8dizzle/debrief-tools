# Homework web app

Mobile-first homepage with real Google Places address lookup and a “Found it” validation screen backed by a warm-neutral palette and teal primary.

## Setup

1) Install dependencies and run dev server:
```bash
npm install
npm run dev
```

2) Environment variables (required for homepage + found screen):
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — enable the Places API in Google Cloud.
- `NEXT_PUBLIC_MAPBOX_TOKEN` — used for the static satellite preview on `/found`.

3) Visit http://localhost:3000 to use the address lookup. On select + submit, the app routes to `/found` to confirm the address and show the “what we know” card.

## Notes
- Colors are set in `app/globals.css` (warm cream base + teal primary).
- External image loading for Mapbox static tiles is enabled in `next.config.ts`.
