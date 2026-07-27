# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm@9.15.9** (pinned in `packageManager`). Vite + React 18, no linter wired up. Test runner is `node --test` (Node's built-in), wired in `package.json` but only covers `src/features/resumen/hooks/useResumenMetrics.test.js` today.

- `pnpm dev` — start Vite on port **5173** (`strictPort: true`, fails if busy). The ored CORS allowlist whitelists 5173/5174/5175, so do NOT change this port unless coordinating with the backend.
- `pnpm build` — production build to `dist/`.
- `pnpm preview` — preview built bundle.
- `pnpm test` — run the node:test suite (currently only `useResumenMetrics.test.js`).
- `pnpm run sync:asesores` — regenerate `src/data/asesores-bp.json` from the `Lista Asesores Activos *.xlsx` file in the repo root. Pass a filename to override: `pnpm run sync:asesores -- "Lista Asesores Activos MAYO.xlsx"`. Re-run whenever the xlsx is updated.

Per global rules: **never run `pnpm build` after changes** unless the user asks.

## Two apps in one bundle (critical architecture)

`src/main.jsx` is a router-by-`window.location.pathname`. There is no react-router. The same Vite bundle serves two surfaces with different security postures:

| Path | Component | Reservas data | Puntos manuales | Auth |
| --- | --- | --- | --- | --- |
| `/cyber` (and `/cyber/*`) | `RankingPublicoPage` | HTTP fetch to **ored.cl** public endpoint | Supabase (anon, read-only) | none (public) |
| everything else | `App` (wrapped in `AuthProvider`) | **ored** API by default, **Supabase** if `VITE_DATA_SOURCE=supabase`, **mock** as fallback | Supabase (anon read + admin write via OTP) | yes |

**`/cyber` DOES import Supabase** (via `useCompetenciaManualRemoteSync`) to read promesas/escrituras synced from the admin. This was decided in `docs/PRD-competencia-manual-sync.md` (Opción B). The `SUPABASE_ANON_KEY` is exposed in the public bundle by design; **RLS must restrict writes** to the admin email list (see `docs/supabase-competencia-manual.sql`). Reservations themselves still flow from ored, not Supabase.

What `/cyber` STILL must not import: `AuthContext`, `useReservas`, or internal-dashboard components. The `AuthProvider` only wraps `App`, never `RankingPublicoPage`.

When adding features, keep this boundary clean:
- New public ranking work → `src/components/RankingPublicoPage.jsx`, `src/hooks/useRankingPublico.js`, `src/hooks/useCompetenciaManualRemoteSync.js`, `src/api/rankingClient.js`, `src/api/competenciaManualRemote.js`, `src/utils/buildRanking.js`, `src/utils/buildRankingCompetencia.js`, `src/components/ranking/*`.
- Internal dashboard work → `src/App.jsx`, `src/features/resumen/*`, `src/components/{CapitalOpenHero,Filters,Reservas*,Competencia*,Rankings*}`, `src/hooks/{useReservas,useCompetencia*}.js`.

## Data flow

### Reservas come from Atlas Engine, avatars from ored (critical)

**Atlas Engine is the primary source of reservas.** It is the only one that reports
whether a reserva fell through (`event_kind: 'fallen'`), which the competition count
must exclude. ored's public endpoint has no state field at all, so a cancelled reserva
was indistinguishable from a live one and kept scoring points.

Atlas does **not** return asesor photos, so ored is still queried **only** to build the
email→avatar map. If Atlas is unavailable, both flows fall back to ored automatically
(with the caveat that fallen reservas become invisible again).

**The Atlas credential must never reach the client.** It grants read access to personal
data (name, email, phone, RUT) of ~1.939 clients. Since `envPrefix` exposes every
`VITE_*`/`SUPABASE_*` var in the public bundle and `/cyber` is unauthenticated, the key
lives as a secret of the `reservas-atlas` Edge Function (`supabase/functions/reservas-atlas/`),
which strips all client data before responding. See `docs/DEPLOY-reservas-atlas.md`.

Two Atlas gotchas encoded in the mappers:
- Use **`uf_valor_propiedad`** for the UF amount, not `uf_valor_reserva` — the latter is
  documented as UF but averages ~40.000 (it's the deposit, likely in CLP). Using it
  inflates the cartera ~11×.
- Atlas rows carry `uf_ya_normalizada: true` so `ufMontoPlanillaReserva()` skips
  `ufNormalizadoPlanilla()`, which exists to repair malformed planilla values and would
  divide any property ≥10.000 UF by 10.

### Public `/cyber` flow
1. `useRankingPublico` calls `fetchReservasAtlas()` (`src/api/atlasClient.js`) for reservas and `fetchReservasRanking()` (`src/api/rankingClient.js`) for avatars, in parallel.
2. Atlas goes through `GET {SUPABASE_URL}/functions/v1/reservas-atlas?desde&hasta`; ored hits `GET {VITE_API_BASE_URL}/api/public/encuentro-smart/ranking`. Both cache ~60s server-side.
3. Rows are normalized by `mapReservaAtlas()` / `mapReservaPublica()`, then aggregated by `buildRankingCompetencia()` into `{ asesores, bps, huerfanos }`.
4. The asesor→BP mapping comes from `src/data/asesores-bp.json` (generated, committed). Join key is **email lowercased**. Asesores with no BP match land in a `sin-bp` bucket and surface as "huérfanos" in the UI — that's the QA signal that the xlsx needs a resync.

### Internal dashboard flow
1. `useReservas` picks its data source by `VITE_DATA_SOURCE` (`atlas` default | `ored` | `supabase` | `mock`).
2. **Default `atlas`**: fetches via the Edge Function proxy, falling back to ored if it fails — no realtime, optional polling via `VITE_DASHBOARD_POLL_MS`.
3. **`supabase`**: reads from the reservas table (`SUPABASE_RESERVAS_TABLE` or `VITE_SUPABASE_RESERVAS_TABLE`, default `reservas`) and subscribes to `postgres_changes` for live updates. If Supabase is not configured, it **silently falls back to `src/data/reservas_mock.json`** — a misconfigured `.env` looks like real data. Check `supabaseConfigured` / `isLive` when debugging "wrong data" reports.
4. **`mock`**: always uses `src/data/reservas_mock.json` — useful for offline dev.
5. Rows are normalized via `src/utils/mapReserva.js` before reaching components.
6. Competencia manual (promesas/escrituras/actividades) flows independently: admin writes go through `pushCompetenciaManualRemote()` to Supabase, with `localStorage` as offline cache. Realtime read via `useCompetenciaManualRemoteSync` (15s poll).

### Vite env prefix quirk
`vite.config.js` sets `envPrefix: ['VITE_', 'SUPABASE_']`, so **bare `SUPABASE_*` vars are exposed to the client** — not just `VITE_SUPABASE_*`. This is deliberate (matches the team's other repos). Treat anything under those two prefixes as public.

## xlsx → JSON sync conventions

`scripts/sync-asesores-bp.mjs` parses the asesores xlsx with strict shape expectations. If the source file format ever changes, update the constants at the top of the script:
- Sheet name prefix: `MBP ` (one sheet per BP, e.g. `MBP Vanema`).
- Row 1 col A = BP long label, row 2+ = asesores, col C = email, col D = estado.
- BP slug is derived by `slugify(sheetName.replace("MBP ", ""))`.

The script warns (does not fail) when the same email appears in multiple BPs — those conflicts are surfaced in `stats.conflictos_email` of the generated JSON.

## Date filtering

All date filtering goes through `src/utils/reservaFecha.js` (`filtrarReservasPorFecha`). The Cyber window is configured via `VITE_CYBER_FECHA_DESDE`/`VITE_CYBER_FECHA_HASTA` (YYYY-MM-DD for the internal app) and `VITE_CYBER_DESDE`/`VITE_CYBER_HASTA` (ISO 8601 with TZ for the public API). They are **different env vars on purpose** — don't unify them without checking both consumers.

## Environment files

- `.env.example` documents only the **public ranking** vars (`VITE_API_BASE_URL`, `VITE_CYBER_DESDE/HASTA`, `VITE_EVENTO_*`).
- `.env.local` (gitignored) additionally holds Supabase + Capital Open vars for the internal app.
- `src/config/capitalOpen.js` centralizes the internal-app branding/window config — read defaults from there before adding new env vars.

## Styling

CSS Modules everywhere (`*.module.css` colocated with each component). No Tailwind, no styled-components. Fonts are Inter + Space Grotesk, loaded from Google Fonts in `index.html`.

## What's intentionally absent

- Test runner is node's built-in `node --test`. Don't add Jest/Vitest config without asking.
- No ESLint/Prettier config. Match surrounding style.
- No TypeScript — `.jsx` + JSDoc typedefs (see `rankingClient.js`, `buildRanking.js`). Keep that pattern.
- No router library. Path-based switch in `main.jsx` is the whole router.
