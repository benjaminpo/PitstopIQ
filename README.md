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

Named profiles (fuel grade, MPG, tank size) live in the sidebar. Guests keep them in `localStorage` on this browser; signed-in users sync the same presets to the database so they follow you across devices.

Enter a UK registration under **Find by registration** to pull make, model (when MOT History is configured), fuel type, hybrid flag, first registration, tax / MOT renewal dates, and an **estimated tank size** (official APIs do not publish capacity — confirm against the handbook). Without API keys, development uses demo plates: `AA19 AAA`, `AA19 DSL`, `AA19 MOT`, `HY21 BRD`.

| Variable | Purpose |
| --- | --- |
| `MOT_HISTORY_*` | [DVSA MOT History](https://documentation.history.mot.api.gov.uk/) — make, model, fuel, engine, MOT dates (primary live path) |
| `DVLA_API_KEY` | [DVLA Vehicle Enquiry](https://developer-portal.driver-vehicle-licensing.api.gov.uk/) — tax status/dates and revenue weight (optional; new VES registrations are often closed) |
| `VEHICLE_LOOKUP_ALLOW_MOCKS` | Force demo fixtures on/off |

## Recent searches

Origin and destination picks appear under **Recent searches** in the place autocomplete. Guests keep them in `localStorage`; signed-in users sync the same history to the account across devices.

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

Signed-in members can **report a pump price** and separately **rate / comment** on a selected station (two independent forms). Stored in Neon (or local SQLite) in `station_contribution` (one row per user per station; each side can be cleared without wiping the other). The most recent member price for the active fuel grade is used for detour scoring when it is at least as fresh as Fuel Finder; if the government API is more recently updated, that official price is used instead. Guests see a sign-in prompt instead of the forms.

Members can also use **Report a missing station** to submit a forecourt that is absent from Fuel Finder. Reports include its map location and optional brand, address, and notes.

### Price alerts (in-app)

Signed-in members can **Watch** a station’s fuel grade from the selected station card. PitstopIQ stores a baseline £/L and, when Fuel Finder prices later drop by the threshold (default 2p/L), creates an unread in-app alert. Alerts and watches are managed under **Account → Price alerts**; the account menu shows an unread badge. Evaluation runs when the member loads alerts (against the cached national dataset) — no email yet.

### Admin workspace

Set `ADMIN_EMAILS` to a comma-separated list of account email addresses. Those users can open `/admin` to:

- review member-submitted missing station reports and open their locations in Google Maps
- browse and search the current Fuel Finder station dataset
- compare Fuel Finder prices with PetrolPrices manually or from an authorised CSV/JSON export
- save station matches and price checks for audit purposes (these do not override public prices)

Non-admin users receive a 404 response for the admin page and API routes.

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

## Google Analytics

Google Analytics 4 is optional. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to a GA4 measurement ID such as `G-XXXXXXXXXX`; leave it unset to disable analytics.

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
3. **Incremental updates** — after the initial national baseline, the app requests price changes from the JSON API every 15 minutes using `effective-start-timestamp`. The updated dataset is kept in process memory and in `fuel_dataset_cache` (Neon in production / SQLite locally), so serverless cold starts continue from the last sync instead of downloading the full dataset. Refreshes are request-triggered; the first request after the interval performs the update.

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
  admin/page.tsx
  account/page.tsx
  api/fuel-finder/route.ts
  api/calculate-detour/route.ts
  api/auth/[...all]/route.ts   # Better Auth handler
  api/missing-station-reports/ # Member submissions and admin review
  api/admin/station-matches/   # Admin station and price checks
  components/   # Route planner, map, station, account, and admin UI
  lib/          # types, detourCalculator, fuelApiAdapter, fuelFinderClient,
                # fuelFinderCsv, database helpers, store, auth, station matching
  login/ register/             # auth pages
  page.tsx
```
