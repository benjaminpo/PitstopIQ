# PitstopIQ

Smart Route Cost Calculator & Detour Planner — decide whether diverting to a cheaper fuel station is a **net financial gain**.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Zustand state · Lucide icons · Leaflet / OpenStreetMap
- Modular API routes with mock Fuel Finder fallback

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
npm test        # unit tests (Vitest)
npm run lint
```

## Live Fuel Finder API

Copy `.env.example` → `.env.local` and set your Information Recipient OAuth credentials from the [Fuel Finder developer portal](https://www.developer.fuel-finder.service.gov.uk/):

```bash
FUEL_FINDER_CLIENT_ID=...
FUEL_FINDER_CLIENT_SECRET=...
FUEL_FINDER_BASE_URL=https://www.fuel-finder.service.gov.uk
```

Without credentials the app uses mock stations. The first live fetch caches the national PFS + prices dataset in memory (~1 hour TTL). The stations list shows a **freshness badge** (`Updated Xm ago`) from that sync time.

## CI / Deploy (GitHub Actions)

Workflows in `.github/workflows/`:

- **CI** — lint + build on push/PR to `main`
- **Deploy to Vercel** — production deploy on push to `main` (and manual `workflow_dispatch`)

Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Fuel Finder credentials stay on the Vercel project env (pulled during deploy). Git auto-deploys from Vercel are disabled so only Actions ships production.

## Project layout

```
app/
  api/fuel-finder/route.ts
  api/calculate-detour/route.ts
  components/   # MapView, RouteForm, StationCard, StationList
  lib/          # types, detourCalculator, fuelApiAdapter, store
  page.tsx
```
