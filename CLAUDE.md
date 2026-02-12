# Priorities

PWA to eliminate decision fatigue during sabbatical. Energy-filtered, time-aware prioritized activity list.

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (via @tailwindcss/vite plugin)
- Convex (backend + real-time database)
- TanStack Router (file-based routing)

## Commands
- `npm run dev` — Start Vite dev server
- `npx convex dev` — Start Convex dev server (run in separate terminal)
- `npm run build` — Production build

## Architecture
- `convex/schema.ts` — Database schema (activities, sessions, energyCostChanges, settings)
- `convex/activities.ts` — Activity queries/mutations + seed data
- `convex/sessions.ts` — Session logging
- `src/lib/prioritization.ts` — Pure prioritization algorithm
- `src/routes/` — TanStack Router file-based routes
- `src/components/` — Shared UI components

## Key Patterns
- Follows treasures/ conventions (Tailwind v4, TanStack Router, Convex)
- Dark theme (slate-900 background)
- No auth library — simple PIN stored in Convex settings table
- Energy levels are React state (not persisted)
- Prioritization is a pure function run client-side

## Spec
- Full product spec in `activity-chooser-spec.md`
