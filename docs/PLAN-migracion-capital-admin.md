# Plan de migración a `capital-admin` (Next, módulo ranking genérico)

> Estado: **documentado, NO ejecutado**. El deploy intermedio en Vercel (ver `docs/DEPLOY-vercel-subdominio.md`) cubre la operación del Cyber 2026 mientras se planifica esta migración.

---

## Context

El dashboard actual (`dashboard-encuentro-smart`, Vite + React 18 SPA) se va a consolidar dentro del panel admin multi-campaña `capital-admin` (`/Users/macbookpro/Documents/HCLP -Capitalinteligente/capital-admin/`), que es Next 16 (App Router) + TypeScript + Tailwind 4 + shadcn (`@capital/ui`) + `@supabase/ssr` + auth OTP custom (`@capital/auth`) + monorepo pnpm/turbo.

**Drivers de la migración:**

1. **Unificar la operación del Cyber con el resto del panel admin** (encuentrosmart, cyber2026 y campañas futuras viven en `capital-admin`).
2. **El "ranking de competencia entre equipos/asesores con puntos por reserva + manuales" es reutilizable**: cualquier campaña multi-equipo futura va a necesitarlo. La forma correcta es construir un módulo genérico parametrizable por campaign, no portar el código específico del Cyber.
3. **Aprovechar capacidades nativas de `capital-admin`**: auth OTP existente, RLS por `panel_member_campaigns`, Server Actions, monorepo con packages compartidos. Eso resuelve estructuralmente los hallazgos C3 (sync sin merge) y A2 (RLS débil) del plan de auditoría (`docs/PLAN-auditoria-dashboard-cyber.md` — ver también el plan vigente F1-F4).

**Decisiones acordadas (sesión 2026-05-20):**

| Decisión | Valor |
|---|---|
| Destino | `capital-admin` (no `capital-open-cyber-web`, no quedarse en repo actual) |
| Alcance | TODO el dashboard: ranking público + dashboard admin |
| Supabase de destino | Proyecto de `capital-admin` (`upygbobjarduunbwzeva.supabase.co`), **distinto** del proyecto compartido con ored (`amfbizcktppiiuxqsflk`) |
| Timing | En paralelo durante el Cyber, cutover suave con ambos dashboards conviviendo |
| Campaign destino | `cyber2026` (ya existe como slug en `@capital/db/types/campaigns.ts`) |
| Diseño | Módulo genérico de ranking parametrizado por campaign — NO port directo del código Cyber |

---

## Hallazgos clave de la exploración de `capital-admin`

Estos hechos cambiaron varias decisiones de diseño respecto del primer borrador:

1. **El URL NO contiene la campaign.** El patrón establecido es plano: `app/(panel)/panel/stats`, `app/(panel)/panel/leads`. La campaign activa se resuelve desde `panel_sessions.active_campaign_id` vía `resolveActiveCampaign(session)` en `lib/session.ts`. Implicación: el módulo ranking vive en `app/(panel)/panel/ranking/`, no en `app/(panel)/[campaign]/ranking/`. El campaign es contexto implícito, no parámetro de URL.

2. **`@capital/admin-modules` es el lugar canónico para features compartidas** (stats, leads, links). Las funciones aceptan `campaignId` como parámetro y hacen queries campaign-aware. Patrón a seguir: `getRankingData(db, { campaignId })`.

3. **NO usan Supabase realtime.** El pattern es Server Components que hacen `select(*)` on render, + Route Handlers o Server Actions para mutations, + (probablemente) revalidación de path/tag o polling client-side. **El sync de 15s de `useCompetenciaManualRemoteSync` se reemplaza por** revalidate-on-window-focus o `revalidateTag('cyber-ranking')` tras Server Action.

4. **Sin middleware.** Auth es per-handler: cada page/action llama `requireSession()` + `resolveActiveCampaign()`. NO hay redirect global por path.

5. **Server Actions en archivos `_actions.ts`** con `'use server'`. Las mutations validan permisos server-side antes de tocar la DB.

6. **`cyber2026` ya existe como slug oficial.** No hay que crearlo en código, pero sí confirmar que existe como row en `public.campaigns` del Supabase de `capital-admin`.

7. **Naming kebab-case** para archivos (`login-form.tsx`, `_actions.ts`). Constantes UPPERCASE. PascalCase para componentes.

---

## Arquitectura objetivo

### Diagrama de carpetas

```
capital-admin/
├── apps/admin/
│   └── src/app/
│       ├── (panel)/panel/
│       │   └── ranking/
│       │       ├── page.tsx                  # Server Component: lista + tabla
│       │       ├── _actions.ts                # Server Actions: save promesa, save actividad, reset
│       │       ├── _components/
│       │       │   ├── ranking-admin-individual.tsx   # 'use client' — formulario edición individual
│       │       │   ├── ranking-admin-equipos.tsx      # 'use client' — formulario edición equipos
│       │       │   └── ranking-totales-hero.tsx       # Server Component: muestra UNA métrica honesta
│       │       └── _hooks/
│       │           └── use-ranking-revalidation.ts    # opcional: polling/revalidate
│       └── public/
│           └── ranking/
│               └── [campaign]/
│                   └── page.tsx               # Server Component, sin auth — ranking embebible
└── packages/
    └── @capital/ranking/                      # NUEVO package
        ├── package.json
        ├── src/
        │   ├── index.ts                       # exports principales
        │   ├── types.ts                       # Asesor, Equipo, Reserva, ManualPoints, Scoring, RankingRow
        │   ├── score.ts                       # SCORING + cálculos por equipo/asesor (engine)
        │   ├── aggregate.ts                   # listAsesoresCompetenciaIndividual, equiposOrdenadosPorPuntos
        │   ├── build.ts                       # buildRankingCompetencia (orquestador)
        │   ├── totals.ts                      # computeCompetenciaTotales (corregido — sin doble conteo)
        │   ├── identity.ts                    # asesorStorageKey (email-first NFD-normalized, fix C2)
        │   ├── compare.ts                     # compareRankingPorPuntosYUf
        │   └── schemas.ts                     # Zod schemas (ScoringConfig, ManualPointsPayload)
        └── tests/                             # node:test o vitest
```

### Tablas DB (en Supabase de `capital-admin`)

```sql
-- Reusamos el patrón de capital-admin: tablas genéricas con campaign_id FK + RLS por panel_member_campaigns.

create table public.ranking_competencia_manual (
  campaign_id text not null references public.campaigns(slug),
  scope text not null check (scope in ('individual', 'team')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, scope)
);

create table public.ranking_competencia_scoring (
  campaign_id text primary key references public.campaigns(slug),
  reserva_pts int not null default 15,
  promesa_pts int not null default 30,
  escritura_pts int not null default 45,
  actividad_online_pts int not null default 15,
  actividad_presencial_pts int not null default 15
);

create table public.ranking_competencia_teams (
  id bigserial primary key,
  campaign_id text not null references public.campaigns(slug),
  team_id text not null,
  label text not null,
  brokers jsonb not null default '[]'::jsonb,  -- shape de EQUIPOS_CAPITAL_ONE
  unique (campaign_id, team_id)
);

-- Si en el futuro se quiere usar el roster del Equipo Comercial Interno como
-- "11vo equipo", se modela igual: una fila por miembro con su email/alias.
create table public.ranking_competencia_internal_team (
  id bigserial primary key,
  campaign_id text not null references public.campaigns(slug),
  member_id text not null,
  nombre text not null,
  emails text[] not null default '{}',
  aliases text[] not null default '{}',
  unique (campaign_id, member_id)
);

-- RLS: SELECT público; INSERT/UPDATE solo via Server Action (security_definer RPC)
alter table public.ranking_competencia_manual enable row level security;
create policy "ranking_manual_select_anon"
  on public.ranking_competencia_manual for select to anon, authenticated using (true);
-- No policies para INSERT/UPDATE — las mutations van solo por Server Action con service role O por RPC security definer.
```

**Por qué tablas genéricas con `campaign_id` y no prefix `cyber_`:** alineado con la filosofía multi-campaña de `capital-admin` (un esquema, N campañas como rows).

### Reservas: NO se migran

Las reservas vienen del endpoint público de ored (proyecto `amfbizcktppiiuxqsflk`, separado). En `capital-admin` se consumen igual via fetch HTTP a `/api/public/encuentro-smart/ranking` — sin cambios. Cliente vive en `@capital/ranking/src/ored-client.ts` o en `@capital/admin-modules/data/ored.ts`.

**Implicación clave:** el cross-Supabase del proyecto se mantiene en el cliente: leemos reservas de ored, escribimos puntos manuales en el Supabase de `capital-admin`. NO hay migración de datos cross-Supabase (ored es read-only; los puntos manuales aún no existen en producción).

---

## Fases del plan

### Fase A — Setup del paquete y schema (3-4 días)

A.1. Crear el package `@capital/ranking` en `capital-admin/packages/`. Esqueleto: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`.

A.2. Portar la lógica de negocio del repo actual a TS con tipos estrictos. Archivos a portar:

| Fuente actual | Destino |
|---|---|
| `src/utils/competenciaCapitalOpenScore.js` | `packages/@capital/ranking/src/score.ts` |
| `src/utils/competenciaCapitalOpenIndividual.js` | `packages/@capital/ranking/src/aggregate.ts` |
| `src/utils/competenciaIndividualToEquipo.js` | `packages/@capital/ranking/src/aggregate.ts` (mismo archivo, son responsabilidades cercanas) |
| `src/utils/buildRankingCompetencia.js` | `packages/@capital/ranking/src/build.ts` |
| `src/utils/competenciaTotales.js` | `packages/@capital/ranking/src/totals.ts` (**corregir C1 — doble conteo**) |
| `src/utils/rankingCompare.js` | `packages/@capital/ranking/src/compare.ts` |
| `src/utils/mapReserva.js` (porción de mapReservaPublica) | `packages/@capital/ranking/src/map.ts` |
| `src/utils/ufNormalize.js` | `packages/@capital/ranking/src/uf.ts` |
| `src/utils/brokerReservaMatch.js` | `packages/@capital/ranking/src/broker-match.ts` (incluye `normNombre` exportada para reuso) |
| `src/data/competenciaCapitalOneTeams.js` | **NO se porta a código** — se vuelve seed SQL para `ranking_competencia_teams` |
| `src/data/equipoComercialInterno.js` | **NO se porta a código** — seed SQL para `ranking_competencia_internal_team` |
| `src/utils/equipoComercialInterno.js` | `packages/@capital/ranking/src/internal-team.ts` (la lógica de matching) |
| `src/utils/asesorBpPlataforma.js`, `src/data/asesores-bp.json` | Mantener en el código por ahora (el script `sync-asesores` se queda, vive en el package). Decidir post-migración si se mueve a DB. |

A.3. Parametrizar todo por config en vez de constantes hardcoded:
- `SCORING` deja de ser export constante → es input de las funciones (`computeTotals(reservas, { scoring, teams, internalTeam, manualPoints })`).
- `EQUIPOS_CAPITAL_ONE` deja de importarse → se pasa como parámetro `teams`.
- `MIEMBROS_EQUIPO_COMERCIAL_INTERNO` idem → parámetro `internalTeam`.

A.4. **Implementar C1 fix dentro del port**: `computeTotals` retorna `{ reservas, puntos, breakdown: { reservaPts, promesaPts, escrituraPts, actividadPts } }` — SIN suma duplicada equipos+individual. Vista una sola vez.

A.5. **Implementar C2 fix dentro del port**: `identity.ts` exporta `asesorIdentity({ email, nombre })` con prioridad email-first y NFD normalization. La lógica corre antes de la agregación, no después.

A.6. Tests con node:test o vitest (alinear con lo que `capital-admin` use ya en su monorepo). Cobertura mínima:
- `computeTotals` — 1 reserva + 1 asesor → puntos correctos, sin doble conteo (test que detecta C1).
- `asesorIdentity` — dos variaciones del mismo asesor (con/sin tilde) → misma identidad.
- `equiposOrdenadosPorPuntos` — empate de puntos → desempate por UF, luego por nombre.
- `aggregateManualIndividualPorEquipo` — empate de votos → resultado determinista.

A.7. Migraciones SQL nuevas en `capital-admin/supabase/migrations/` con las 4 tablas + seed inicial para `cyber2026`. **El seed se genera del estado actual de `EQUIPOS_CAPITAL_ONE` y `MIEMBROS_EQUIPO_COMERCIAL_INTERNO`** — un script de migración en `scripts/seed-cyber2026.ts` que lee los archivos JS actuales y emite INSERTs.

### Fase B — Server Actions y Route Handler público (2 días)

B.1. Crear `apps/admin/src/app/(panel)/panel/ranking/_actions.ts` con `'use server'`:

```ts
'use server'
import { requireSession, resolveActiveCampaign } from '@capital/auth'
import { rankingManualUpsertPartial } from '@capital/admin-modules/ranking'

export async function saveAsesorPoints(input: SaveAsesorPointsInput) {
  const session = await requireSession()
  const campaign = await resolveActiveCampaign(session)
  // RLS layer en el server action — campaign-aware
  return rankingManualUpsertPartial({
    campaignId: campaign.id,
    scope: 'individual',
    partial: { [input.asesorKey]: input.entry },
  })
}
```

Esto resuelve C3 (sync sin merge) **gratis**: el server hace el merge JSONB con `data = data || $1`, atómico, RLS implícita.

B.2. Route Handler público para ranking embebible:

```ts
// apps/admin/src/app/public/ranking/[campaign]/route.ts (o /page.tsx para HTML)
import { getRankingData } from '@capital/admin-modules/ranking'
import { CAMPAIGN_SLUGS } from '@capital/db/types/campaigns'

export async function GET(req, { params }) {
  if (!CAMPAIGN_SLUGS.includes(params.campaign)) return Response.json({error: 'invalid_campaign'}, {status: 404})
  const data = await getRankingData({ campaignSlug: params.campaign })
  return Response.json(data, { headers: { 'cache-control': 'public, s-maxage=15, stale-while-revalidate=60' }})
}
```

**Cache de 15s server-side** reemplaza el polling de 15s client-side del `useCompetenciaManualRemoteSync`. Mucho más eficiente: Vercel Edge cachea, todos los visitantes leen del CDN, no de Supabase.

B.3. Versión HTML embebible (Server Component): `apps/admin/src/app/public/ranking/[campaign]/page.tsx`. Sin `'use client'`, sin estado, sin polling cliente — se renderiza server-side cada 15s (revalidate=15) y se sirve estática.

### Fase C — UI admin (3-4 días)

C.1. Página principal `apps/admin/src/app/(panel)/panel/ranking/page.tsx` (Server Component):
- Resuelve `campaign` activa de la sesión.
- Llama `getRankingData(campaign.slug)`.
- Renderiza tabs: "Equipos" | "Individual" | "Resumen".

C.2. Formularios de edición (Client Components con `'use client'`):
- `ranking-admin-individual.tsx`: lista de asesores con inputs de promesas/escrituras. `useFormState` con la Server Action `saveAsesorPoints`. Sin localStorage — Server Action es la fuente de verdad.
- `ranking-admin-equipos.tsx`: 9 equipos con botones "Registrar online" / "Registrar presencial". Igual: Server Action `registrarActividad`. **C4 muere acá**: no hay `setState` anidado porque no hay state local complejo, el Server Action devuelve el nuevo total y React revalida.

C.3. Hero/Totales: Server Component que muestra UNA métrica honesta (resolución pendiente de F0.2 del plan F1-F4 — semántica con producto). En la migración aprovechamos para tomar la decisión definitiva.

C.4. UI library: usar `@capital/ui` para `<Card>`, `<Button>`, `<Tabs>`, `<Input>`. Eliminar CSS Modules; pasar todo a Tailwind con `cn()` helper.

C.5. Comportamiento "draft vs saved": en el repo actual cada asesor tiene estado de borrador antes de guardar. Mantener UX similar pero local al componente cliente (`useState` interno) — no necesita ref global. Al guardar, llamar Server Action y revalidar (`router.refresh()` o `revalidateTag('cyber-ranking')`).

### Fase D — Ranking público y branding (2 días)

D.1. UI del ranking público (Server Component) en `apps/admin/src/app/public/ranking/[campaign]/page.tsx`:
- Layout específico (sin sidebar del panel admin).
- Branding por campaign desde `campaigns.theme_slug`.
- Tabla de equipos + tabla de asesores + podio top 3 (componente `<RankingPodium>` que sí va a `@capital/ui` porque es reutilizable).

D.2. Componentes a portar:
- `Avatar` y `CrownIcon` (públicos, reutilizables) → `@capital/ui`.
- `RankingPodium`, `RankingTable` → `@capital/ui` (genéricos, reciben datos como props).
- Estilos: pasar de CSS Modules a Tailwind. Las paletas (azul Capital Open) viven en el theme correspondiente en `@capital/themes`.

D.3. Polling/revalidation cliente: opcional `useRankingRevalidation()` que cada N segundos llama `router.refresh()`. Pero la cache CDN de 15s ya cubre 95% del caso — probablemente innecesario.

### Fase E — Auth admins por campaign (1 día)

E.1. Los coordinadores Cyber 2026 se dan de alta en `panel_member_campaigns` con `campaign_id = 'cyber2026'`. Esto reemplaza `VITE_ADMIN_EMAILS`. Esto es **datos**, no código — script en `scripts/seed-cyber2026-admins.ts`.

E.2. Eliminar el lock client-side de `useAuth().canEditCompetencia` — ya no se necesita, la verificación vive en el Server Action via `requireSession()` + role check en `panel_member_campaigns`.

E.3. UX: si el coordinador no tiene rol admin en `cyber2026`, el `/ranking` muestra solo lectura.

### Fase F — Cutover suave (1 día efectivo + ventana de gracia)

F.1. Ambos dashboards corren en paralelo:
- Vite (Vercel subdominio) → operación oficial del Cyber.
- Next (`capital-admin`) → preview/staging hasta que esté validado.

F.2. Validación pre-cutover (checklist):
- Crear 1 promesa, 1 escritura, 1 actividad en Next → aparece en el ranking público del Next con los puntos correctos.
- Coordinador real loguea en Next → ve el ranking, edita, guarda. Cambios persisten.
- Open the cyber ranking en otro navegador → ve los cambios en ≤ 30s.
- Comparar números entre Vite y Next con los mismos datos (debe coincidir; **excepto** el "Total competencia" del hero, que en Next es la métrica corregida sin doble conteo).

F.3. Migración de puntos manuales acumulados durante el Cyber:
- Si los coordinadores ya cargaron puntos en el Vite + Supabase `amfbizcktppiiuxqsflk`, **hay que migrarlos** al Supabase de `capital-admin` antes del cutover.
- Script `scripts/migrate-puntos-cyber.ts`: `SELECT data FROM amfbizcktppiiuxqsflk.encuentro_competencia_manual` → transform → `INSERT INTO upygbobjarduunbwzeva.ranking_competencia_manual (campaign_id='cyber2026', ...)`.
- Coordinar ventana de mantenimiento: ~15 minutos sin escritura, freeze de puntos manuales, migración, validación, swap.

F.4. Cutover real:
- Día X (a definir con producto, post-pico Cyber idealmente):
  - 09:00: comunicar a coordinadores, freeze de edición en Vite.
  - 09:15: ejecutar script de migración.
  - 09:30: validar paridad.
  - 09:45: actualizar bookmark/URL TV pública al dominio Next.
  - 10:00: apagar deploy Vite (mantener repo + branch como histórico).

F.5. Después del cutover:
- Repo `dashboard-encuentro-smart` se archiva en GitHub (read-only, no se borra).
- `docs/PLAN-auditoria-dashboard-cyber.md` y `docs/PLAN-migracion-capital-admin.md` se copian a `capital-admin/docs/` para preservar el contexto histórico.
- Tabla `encuentro_competencia_manual` en `amfbizcktppiiuxqsflk` queda como backup; eliminar tras 30 días.

---

## Estimación total

| Fase | Esfuerzo | Riesgo | Reusable |
|---|---|:--:|:--:|
| A — Setup paquete + schema | 3-4 días | Bajo | Alto (núcleo del módulo genérico) |
| B — Server Actions + Route Handler | 2 días | Bajo | Alto |
| C — UI admin | 3-4 días | Medio | Medio (algunos componentes genéricos) |
| D — Ranking público + branding | 2 días | Bajo | Alto (RankingPodium genérico) |
| E — Auth admins por campaign | 1 día | Bajo | Total (es el patrón de `capital-admin`) |
| F — Cutover | 1 día + ventana | Medio | N/A |

**Total: 12-14 días hábiles** (~3 semanas reales con contingencia).

Esta inversión deja `@capital/ranking` listo para usar en `cyber2027`, `encuentro_smart_2027` o cualquier campaña futura multi-equipo, donde el setup será **solo** poblar las tablas `ranking_competencia_teams`, `ranking_competencia_scoring` y `panel_member_campaigns` para esa campaign.

---

## Bugs del plan F1-F4 que se resuelven gratis con esta migración

| Hallazgo | Cómo se resuelve |
|---|---|
| **C1 — doble conteo** | Se reescribe `totals.ts` con el modelo correcto desde el día uno (vista única). |
| **C2 — identidad inconsistente** | `identity.ts` con email-first NFD normalization desde el día uno. |
| **C3 — push masivo sin merge** | Server Action hace merge atómico server-side. RLS implícita. |
| **C4 — setState anidado** | UI se rehace con Server Actions; el patrón problemático no existe en el nuevo código. |
| **A1 — CLAUDE.md desactualizado** | El CLAUDE.md viejo se archiva con el repo viejo. Se crea uno nuevo en `capital-admin` si aplica. |
| **A2 — RLS débil** | RLS de `capital-admin` ya verifica `panel_member_campaigns` con `campaign_id`. |
| **A3 — timezone** | (era falso positivo, no aplica) |
| **A4 — stale closure** | Hook se reescribe en TS estricto con deps correctas; ESLint del monorepo cazará exhaustive-deps. |
| **A5 — bundle bloat /cyber** | Next App Router separa client/server automáticamente. RankingPúblico es Server Component, no incluye chartlib en el bundle público. |
| **A6 — ErrorBoundary parcial** | Next tiene `error.tsx` por route — cubierto nativamente. |
| **M1-M3 — monolitos + utils dispersos** | Se reescriben como módulos pequeños con SRP en `@capital/ranking`. |
| **M4 — useReservas sin abort** | `useReservas` muere; reemplazado por Server Component fetch. |
| **M5-M7 — caché global, lazy init, cascadas** | Estado local en `useState` por componente, sin singletons globales. |
| **M8 — sin tests** | Se escribe suite mínima como parte de Fase A. |
| **B1-B8 — deuda variada** | El repo viejo se archiva; deuda muere con él. |

**Hallazgos que NO se resuelven solos** (hay que portarlos a mano):
- F0.2 (decisión de producto sobre semántica del hero) — sigue pendiente, se decide al implementar `ranking-totales-hero.tsx`.
- F0.5 (lista de admins) — se traslada a `panel_member_campaigns` con `campaign_id='cyber2026'`.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|:--:|---|
| Curva de aprendizaje Server Components vs SPA | Media | Empezar por las funciones puras (Fase A) — son JS→TS directo. Server Components/Actions se aprenden en Fase B-C. |
| `capital-admin` cambia su API interna durante la migración | Baja | El equipo del admin no se prevé que rehaga `@capital/admin-modules`. Si pasa, coordinar via PR conjunto. |
| Migración de puntos manuales falla durante cutover | Media | Hacer dry-run del script días antes con datos reales. Tener rollback al Vite hasta confirmar paridad. |
| `cyber2026` no existe como row en `public.campaigns` aunque sí en el enum | Media | Verificar en Fase A con `SELECT * FROM campaigns WHERE slug='cyber2026'`. Si falta, insertar. |
| El theme/branding visual del Cyber no existe en `@capital/themes` | Media | Crear un theme `cyber2026-azul-naranja` (o similar) en Fase D. |
| Cross-Supabase: reservas en ored, puntos en capital-admin | Aceptado | Documentar como decisión deliberada. Cliente ored se reusa tal cual. |
| Migrar durante Cyber introduce inestabilidad | **Alta** si se hace mal | Plan F (cutover) tiene ventana específica, ambos dashboards conviven. Si Next falla en pruebas, no se hace cutover. |

---

## Archivos a leer del proyecto `capital-admin` antes de empezar

(Para que el dev que arranque la migración tenga el contexto exacto del patrón)

- `apps/admin/src/app/(panel)/panel/stats/page.tsx` — patrón de page que resuelve campaign activa
- `apps/admin/src/app/(panel)/panel/links/_actions.ts` — patrón de Server Action
- `apps/admin/src/app/(panel)/panel/links/page.tsx` — patrón completo
- `packages/@capital/admin-modules/src/` (cualquier feature) — patrón de funciones campaign-aware
- `packages/@capital/auth/src/` (entry points) — `requireSession`, `resolveActiveCampaign`
- `packages/@capital/db/types/campaigns.ts` — CAMPAIGN_SLUGS y tipos
- `packages/@capital/db/migrations/` o `supabase/migrations/` — patrón de RLS con `campaign_id`
- `turbo.json` — buildchain del monorepo
- `apps/admin/vercel.json` — config de deploy

---

## Decisiones pendientes antes de arrancar

1. **¿La migración arranca antes o después del pico del Cyber?** Acordado: en paralelo durante el Cyber, cutover suave. Pero hay que definir fecha específica del cutover.
2. **¿Producto define qué muestra el hero de `Totales`?** (F0.2 del plan F1-F4). Sin esto, `ranking-totales-hero.tsx` queda en limbo.
3. **¿Quién es responsable del data seed inicial?** (equipos, scoring, admins por campaign). Idealmente el coordinador Cyber con apoyo del dev.
4. **¿Cross-Supabase se acepta como decisión permanente, o eventualmente se consolida un solo proyecto Supabase?** Decisión de infra, fuera del scope de esta migración pero relevante para el roadmap.
5. **¿La tabla `encuentro_competencia_manual` en `amfbizcktppiiuxqsflk` se borra tras cutover, o queda archivada?** Recomendación: archivar 30 días, después drop.

---

## Próximo paso al retomar este plan

1. Validar este documento con el equipo backend de `capital-admin` (entender si el patrón propuesto encaja con su roadmap).
2. Confirmar la fecha de cutover con producto.
3. Cuando todo esté alineado, arrancar Fase A en una rama nueva de `capital-admin`: `git checkout -b feat/ranking-competencia-module`.
