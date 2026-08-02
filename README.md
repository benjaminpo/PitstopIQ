# PitstopIQ

Smart Route Cost Calculator & Detour Planner — decide whether diverting to a cheaper fuel station is a **net financial gain**.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Zustand state · Lucide icons · Leaflet / OpenStreetMap
- Modular API routes; live Fuel Finder with CSV primary / JSON API backup (mocks in development only)

## Math (UK units)

- 1 UK gallon = **4.54609** litres
- Litres/mile = `4.54609 / MPG`
- Detour fuel cost = extra miles × litres/mile × station £/L
- Gross savings = (base route avg £/L − station £/L) × litres to refill
- **Fuel net** = gross savings − detour fuel cost
- Time cost = (extra detour minutes / 60) × value of time (£/h, default £12)
- **Net after time** = fuel net − time cost — used for status & ranking
- Status: green (> £0.50), amber (± £0.50), red (< −£0.50)

Extra minutes come from OSRM (A→station→B vs direct A→B). When routing fails, minutes are estimated from extra miles using the route’s average speed.

Stations are filtered to a **3 mi corridor** along the OSRM driving polyline (not the rectangular map bounds). Only those forecourts are scored and shown.

## Share / bookmark a trip

The address bar stays in sync with your trip. Copy it, bookmark it, or use **Share** in the header.

Query params: `from`, `to` (lat,lng), `fromLabel`, `toLabel`, `fuel`, `mpg`, `tank`, `fill`, `refill`, `vot` (£/h), optional `base` (manual £/L).

## Vehicle presets

Named profiles (fuel grade, MPG, tank size) are stored in `localStorage` via Zustand persist. Switch, save, update, or delete them in the sidebar — they survive reloads on this browser.

## Brand filters

Stations can be filtered to **Supermarket** (Tesco, Asda, Sainsbury’s…), **Motorway** (Moto, Welcome Break, Roadchef, MSA…), or **Premium** (Shell, BP, Esso…). Classification uses brand + trading-name heuristics.

## Remaining range

Stations beyond the usable range from **current fill %** are hidden. Range = tank litres × fill% × MPG (UK gallon), with a 5% reserve so you don’t plan to arrive empty. Distance to each station is estimated along the OSRM route plus the spur off-route.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test           # unit tests (Vitest)
npm run test:coverage
npm run lint
```

## User accounts (register / login)

Email + password authentication via [Better Auth](https://better-auth.com). Pages: `/register` and `/login`; the account menu lives in the sidebar header.

```bash
# .env.local (dev — SQLite when DATABASE_URL is unset)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

### Production database (Neon)

Production uses [Neon](https://neon.tech) Postgres. Set these on the Vercel project (**Production** env):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (`…-pooler…` host, `sslmode=require`) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://pitstopiq.vercel.app` (public; use `--no-sensitive` so CI/`vercel pull` can read it) |

Create the auth tables once against Neon (run locally; never commit the URL):

```bash
DATABASE_URL='postgresql://…?sslmode=require' \
  npx @better-auth/cli@latest migrate --config app/lib/auth.ts -y
```

Redeploy after adding or changing env vars so serverless functions pick them up.

### Member station updates

Signed-in members can **report a pump price** and separately **rate / comment** on a selected station (two independent forms). Stored in Neon (or local SQLite) in `station_contribution` (one row per user per station; each side can be cleared without wiping the other). The most recent member price for the active fuel grade is used for detour scoring when present; guests see a sign-in prompt instead of the forms.

## Google AdSense

Optional monetization. Ads load only when `NEXT_PUBLIC_ADSENSE_CLIENT` is set.

1. Create an [AdSense](https://www.google.com/adsense/) account and add your live site URL.
2. Set env (local + Vercel):

```bash
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
# After creating a Display ad unit in AdSense:
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=1234567890
```

3. Deploy, then confirm `https://your-domain/ads.txt` lists your publisher ID.
4. In AdSense you can also enable **Auto ads**; the script in the root layout supports that even without a sidebar slot.
5. Ads typically do **not** fill on `localhost` — test on the production domain after approval.

UK/EU: enable AdSense’s consent messaging (or your own CMP) for personalized ads.

## Live Fuel Finder

Fuel prices come from the UK [Fuel Finder](https://www.developer.fuel-finder.service.gov.uk/) Information Recipient APIs.

### Env vars

Copy `.env.example` → `.env.local`, then set the same values on the Vercel project (**Production**). Redeploy after any env change so serverless functions pick them up.

| Variable | Required | Purpose |
| --- | --- | --- |
| `FUEL_FINDER_CLIENT_ID` | Yes (live) | OAuth client id from the developer portal |
| `FUEL_FINDER_CLIENT_SECRET` | Yes (live) | OAuth client secret |
| `FUEL_FINDER_BASE_URL` | No | Defaults to `https://www.fuel-finder.service.gov.uk` |
| `FUEL_FINDER_TRANSPORT_SECRET` | Yes (CSV path) | Portal SPA transport key used to decrypt the CSV presign response — keep in env/Vercel only, never in source |
| `FUEL_FINDER_ALLOW_MOCKS` | No | Set `true` on a preview deploy to allow demo stations |

```bash
FUEL_FINDER_CLIENT_ID=...
FUEL_FINDER_CLIENT_SECRET=...
FUEL_FINDER_BASE_URL=https://www.fuel-finder.service.gov.uk
FUEL_FINDER_TRANSPORT_SECRET=...
```

### How a live load works

1. **CSV (primary)** — authenticated presign → S3 download of the national prices CSV (same snapshot linked from [access latest fuel prices](https://www.developer.fuel-finder.service.gov.uk/fuel-finder/access-latest-fuelprices)). Usually a few seconds.
2. **JSON API (backup)** — paginated `/api/v1/pfs` + `/fuel-prices` if CSV fails. Rate-limited (~30 rpm); a full national pull can take about a minute — avoid relying on this in production by setting `FUEL_FINDER_TRANSPORT_SECRET`.
3. **Cache** — the national dataset is kept in process memory and in the app database (`fuel_dataset_cache`, Neon in production / SQLite locally) for ~1 hour, so cold serverless instances and reloads do not re-download every time. Live `/api/fuel-finder` responses also send `Cache-Control` so the CDN can serve repeated bounds queries.

Without OAuth credentials the app uses mock stations **in development only** (clearly labelled). In production, missing credentials or a failed live fetch return an error with a retry button — never fabricated forecourts. The stations list shows a **freshness badge** (`Updated Xm ago`) from the last successful sync.

Serverless functions run in **London (`lhr1`)** — Fuel Finder’s CloudFront edge blocks non-UK IPs with a bare 403, so the US default region (`iad1`) cannot obtain a token.

## CI / Deploy (GitHub Actions)

Workflows in `.github/workflows/`:

- **CI** — lint, test (with coverage), build, and [SonarCloud](https://sonarcloud.io/dashboard?id=benjaminpo_PitstopIQ) analysis on push/PR to `main`
- **Deploy to Vercel** — production deploy on push to `main` (and manual `workflow_dispatch`)

Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SONAR_TOKEN`.

### SonarCloud

Project key `benjaminpo_PitstopIQ` (org `benjaminpo-gh`). Config lives in `sonar-project.properties`.

1. In [SonarCloud](https://sonarcloud.io) → project **Administration** → **Analysis Method**: **disable Automatic Analysis** (CI analysis conflicts with Autoscan).
2. Create a token (**My Account** → **Security**) and add it as the GitHub Actions secret `SONAR_TOKEN`.
3. Push or open a PR — CI uploads coverage from `coverage/lcov.info` and fails the job if analysis cannot authenticate.

Fuel Finder credentials stay on the Vercel project env (pulled during deploy). Git auto-deploys from Vercel are disabled so only Actions ships production.

## Project layout

```
app/
  api/fuel-finder/route.ts
  api/calculate-detour/route.ts
  api/auth/[...all]/route.ts   # Better Auth handler
  components/   # MapView, RouteForm, StationCard, StationList, AuthForm, AccountMenu
  lib/          # types, detourCalculator, fuelApiAdapter, fuelFinderClient,
                # fuelFinderCsv, fuelDatasetCache, fuelConstants, store, auth
  login/ register/             # auth pages
  page.tsx
```
