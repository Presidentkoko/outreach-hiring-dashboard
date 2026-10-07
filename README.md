# Outreach Hiring · Recruiting Dashboard (demo)

A live dashboard that reads a Google Sheet of recruiting leads, cleans it on the server, and shows lead counts by pipeline stage, week by week.

**Demo sheet (fake data):** https://docs.google.com/spreadsheets/d/1-61MuRMv37x_dhEDhDwc2ZNuv49ZQoibVhBWyfmRUH0

## What it does

- Reads the `Leads` and `Spend` tabs on every request (no database, no cache).
- Cleans the data: merges duplicate people (email first, then phone), drops test rows, parses four different date formats.
- Counts by the Stats v2 rules: Leads, Abandoned quiz and Disqualified in the week the lead was created; every later stage in the week it was dispoed. Weeks run Monday to Sunday, Pacific time.
- Shows six KPIs with week-over-week change, leads-per-week chart, funnel, the weekly breakdown table, and a live feed.
- Refreshes itself every 30 seconds, pauses while the tab is hidden, and shows a live indicator with a countdown.
- Works on a phone.

## How it is built

```
src/config/settings.ts         one settings file: sheet ID, tab + column names, stages, branding, refresh timing
src/lib/data/                  the only code that knows where data comes from
  ├─ types.ts                  RawData shape every source must return
  ├─ index.ts                  getDataSource(): picks the source (DATA_SOURCE env)
  └─ sources/google-sheets.ts  Google Sheets via service account, or public CSV export as fallback
src/lib/clean.ts               duplicates, test rows, mixed date formats, Pacific calendar days
src/lib/stats.ts               weekly counts, KPIs, funnel, feed
src/app/api/stats/route.ts     the one server route the browser calls
src/components/Dashboard.tsx   the page
```

Pages never touch Google. They call `/api/stats`, which runs on the server. Swapping Google Sheets for the GoHighLevel API means adding one file under `src/lib/data/sources/` and nothing else.

## Credentials

Nothing sensitive reaches the browser. In production, set `GOOGLE_SERVICE_ACCOUNT_KEY` in Vercel to the base64 of the service-account JSON and share the sheet with the service account's email. The key is read only inside the server route with a read-only scope. If the variable is not set, the app falls back to the sheet's public CSV export, which is what this demo uses (fake data, shared by link).

See `.env.example`.

## Run locally

```bash
npm install
npm run dev
```

`npx tsx scripts/check-stats.mts` prints the weekly table in the terminal, straight from the sheet.
`node scripts/gen-data.mjs` regenerates the fake data in `data/`.
