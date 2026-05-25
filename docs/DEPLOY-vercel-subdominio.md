# Deploy a Vercel — subdominio

> Plan operacional para desplegar `dashboard-encuentro-smart` (Vite + React) en Vercel bajo un subdominio. Vive en producción mientras se ejecuta el plan de migración a `capital-admin` (ver `docs/PLAN-migracion-capital-admin.md`).

---

## Contexto

El dashboard hoy NO está hospedado en Vercel (al menos no documentado en el repo). El repo está en GitHub `vpedrerop/dashboard-encuentro-smart`, branch activa `feat/ranking-publico-cyber`. El stack es Vite + React 18 SPA, sin server-side, dos surfaces servidas por path-based switch (`/cyber*` público + resto dashboard interno con Supabase OTP).

Objetivo: deploy productivo bajo un subdominio (ej. `dashboard-cyber.capitalinteligente.cl` o `cyber.ored.cl`), con auto-deploy desde GitHub en cada push a la rama elegida.

## Decisiones pendientes (responder antes de ejecutar)

1. **Subdominio definitivo**: ¿qué hostname? Recomendación: usar un subdominio que ya esté delegado en Vercel o Cloudflare para evitar coordinar DNS con un tercero. Si el dominio raíz es `capitalinteligente.cl`, confirmar quién administra el DNS.
2. **Rama a publicar**: ¿`feat/ranking-publico-cyber` (rama actual) o mergeas a `main` primero? Vercel toma una "Production Branch"; el resto producen Preview Deployments.
3. **Cuenta Vercel**: ¿cuál team? Si el equipo HCLP/Capital ya tiene Vercel (los proyectos `capital-admin` y `capital-open-cyber-web` están allí), usar el mismo team para tener facturación unificada.
4. **CORS allowlist de ored**: el endpoint público de ored hoy permite `localhost:5173/5174/5175`. Hay que **añadir el dominio de producción** (`https://<subdominio>.<dominio>` y el `.vercel.app` de preview si aplica). Es un cambio que solicitas al backend de ored. Sin esto, `/cyber` muestra "Failed to fetch" en producción.

---

## Pre-requisitos

- Repo en GitHub conectable con Vercel (`vpedrerop/dashboard-encuentro-smart`). Si el usuario `vpedrerop` no es el del team Vercel, hay que dar acceso de lectura al repo desde la integración GitHub-Vercel.
- Acceso al panel DNS del dominio donde irá el subdominio.
- Variables de entorno disponibles para producción (ver §3).

---

## Pasos

### 1. Crear el proyecto en Vercel

1. Entrar a vercel.com → New Project → Import Git Repository → seleccionar `vpedrerop/dashboard-encuentro-smart`.
2. Vercel detecta automáticamente:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build` (Vercel detecta `pnpm` por `pnpm-lock.yaml`)
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Node version**: heredada de Vercel default (Node 20+). No requiere override.
3. **NO presionar Deploy todavía** — primero configurar env vars (§3) y rama (§2).

### 2. Configurar rama de producción

En Project Settings → Git:

- **Production Branch**: elegir la rama que sirve producción. Hoy = `feat/ranking-publico-cyber`. Recomendación: mergear a `main` ANTES del primer deploy productivo, y dejar `main` como Production Branch. Esto desacopla "lo que está en producción" de la rama de feature en curso.
- **Deploy Hooks**: dejar en default. Cada push a Production Branch dispara deploy productivo. Cada push a otra rama dispara Preview Deployment (URL temporal tipo `dashboard-encuentro-smart-git-<rama>.vercel.app`).
- **Ignored Build Step**: dejar default. Vercel reconstruye cada commit.

### 3. Variables de entorno (CRÍTICO)

En Project Settings → Environment Variables, agregar para **Production** y **Preview** (toma los valores reales del `.env.local` actual o del proyecto ored):

| Variable | Valor (referencia) | Notas |
|----------|--------------------|-------|
| `VITE_API_BASE_URL` | `https://www.ored.cl` | Endpoint público de ored. Sin trailing slash. |
| `VITE_CYBER_DESDE` | `2026-05-15T00:00:00-04:00` | ISO 8601 con TZ Chile. |
| `VITE_CYBER_HASTA` | `2026-07-15T23:59:59-04:00` | ISO 8601 con TZ Chile. |
| `VITE_EVENTO_NOMBRE` | `Encuentro Smart` | Branding del header `/cyber`. |
| `VITE_EVENTO_SUBTITULO` | `Cyber Junio 2026` | Branding del header `/cyber`. |
| `VITE_CAPITAL_OPEN_NOMBRE` | `Capital Open` | Branding dashboard interno. |
| `VITE_CAPITAL_OPEN_SUBTITULO` | `Cyber Junio` | Branding dashboard interno. |
| `VITE_CAPITAL_OPEN_LOGO_URL` | `/capital-open-logo.png` | Asset en `public/`. |
| `VITE_CYBER_FECHA_DESDE` | `2026-05-15` | YYYY-MM-DD (NO confundir con `VITE_CYBER_DESDE`). |
| `VITE_CYBER_FECHA_HASTA` | `2026-07-15` | YYYY-MM-DD. |
| `VITE_CYBER_POLL_MS` | `1800000` | 30 min, default. |
| `VITE_CYBER_MANUAL_POLL_MS` | `15000` | 15 s sync remoto Supabase. |
| `SUPABASE_URL` | `https://amfbizcktppiiuxqsflk.supabase.co` | Mismo proyecto que ored. |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUz...` (anon, ver `.env.local`) | Solo anon. RLS protege. |
| `VITE_ADMIN_EMAILS` | (pendiente F0.5 del plan F1-F4) | Coma-separados. Sin esto, el lock admin no se activa. |

Cosas que NO van en Vercel env (porque hoy no se usan en producción):
- `VITE_DATA_SOURCE` — default `ored` está bien.
- `VITE_SUPABASE_RESERVAS_TABLE` — solo aplica si `VITE_DATA_SOURCE=supabase`.
- `VITE_DASHBOARD_POLL_MS` — opcional.

Importante sobre el `envPrefix` de Vite: el `vite.config.js` define `envPrefix: ['VITE_', 'SUPABASE_']`, lo que significa que las vars `SUPABASE_URL` y `SUPABASE_ANON_KEY` SIN prefijo `VITE_` también se exponen al bundle del cliente. Esto es **deliberado y documentado en CLAUDE.md**. No renombrar.

### 4. Configurar SPA rewrites (CRÍTICO)

El proyecto usa un router por `window.location.pathname` (no react-router). Vercel sirve archivos estáticos desde `dist/`, lo que significa que `/cyber` sin handler devuelve 404 porque no existe un `dist/cyber/index.html`.

**Solución**: crear `vercel.json` en la raíz del repo con un rewrite catch-all a `index.html`. Así Vercel sirve siempre el `index.html` (que arranca el JS) y el JS lee `window.location.pathname` para decidir qué renderizar.

Archivo a crear (no se ejecuta en este plan, queda como acción):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Esto debe commitearse al repo ANTES del primer deploy. Sin esto, abrir `https://<subdominio>/cyber` directo (o recargar en esa ruta) muestra 404 de Vercel en vez del ranking.

### 5. Primer deploy

1. Con env vars seteadas + rama configurada + `vercel.json` commiteado, presionar **Deploy** en Vercel.
2. Build tarda ~2-3 min (Vite es rápido). Vercel sirve en `https://dashboard-encuentro-smart.vercel.app` (o nombre similar).
3. **Smoke test pre-cutover** sobre el `.vercel.app`:
   - `https://<deploy>.vercel.app/cyber` → debe cargar el ranking público. Si "Failed to fetch", ored NO autoriza el origin (ver §1.4 decisión pendiente).
   - `https://<deploy>.vercel.app/` → debe cargar el dashboard interno (loader, luego app).
   - DevTools → Network → confirmar que `fetch` a `https://www.ored.cl/api/public/encuentro-smart/ranking` responde 200.
   - Login OTP: requiere que el email esté autorizado en Supabase (hay 1 sólo usuario en `auth.users` hoy — ver `PLAN-migracion-capital-admin.md` y `F0.5` del plan F1-F4).

### 6. Conectar el subdominio

En Project Settings → Domains:

1. Agregar el subdominio elegido (ej. `dashboard-cyber.capitalinteligente.cl`).
2. Vercel da un CNAME que apunta a `cname.vercel-dns.com`. Configurar ese CNAME en el panel DNS del dominio.
3. Esperar propagación (≤ 10 min usualmente). Vercel emite SSL automático (Let's Encrypt).
4. **Comunicar al equipo ored**: pedir que añadan el nuevo dominio a la CORS allowlist del endpoint público. Sin esto, el `/cyber` muestra "Failed to fetch" desde el subdominio definitivo aunque funcione en el `.vercel.app`.

### 7. Cutover

Si el dashboard ya está hospedado en otro lugar (ej. servidor propio, otra plataforma), planificar el cutover:

- Comunicar al equipo (24h antes mínimo).
- Cambiar bookmarks/enlaces internos al subdominio Vercel.
- Si hay TVs apuntando al ranking público, actualizar la URL en el dispositivo.
- Mantener el deploy viejo encendido por 48h después del cutover como red de seguridad. Apagar cuando se confirme que nadie lo usa.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|:--:|---|
| CORS de ored rechaza el dominio nuevo | Alta | Pedir whitelist a backend ANTES del cutover. Sin esto, `/cyber` rompe. |
| Variables de entorno mal copiadas (especialmente `SUPABASE_ANON_KEY` o `VITE_API_BASE_URL`) | Media | Validar con DevTools en el `.vercel.app` antes de conectar el subdominio. |
| Olvido del `vercel.json` → 404 al recargar `/cyber` | Alta si se olvida | Commitear `vercel.json` ANTES del deploy. Probar recargar la página `/cyber` directamente. |
| Cache de Vercel sirve build viejo tras env var change | Media | Tras cambiar env vars en Vercel, hacer **Redeploy** manual (no solo re-push). Vercel necesita re-build para inyectar las nuevas vars. |
| Preview deployments accidentalmente públicos con datos sensibles | Baja | Vercel permite restringir preview deployments con password (Settings → Deployment Protection). Considerar habilitar para `dashboard interno`. |
| Deploy bloqueado por scope de pnpm o lockfile desactualizado | Baja | `pnpm install --frozen-lockfile` ya es el default Vercel. Si falla, regenerar `pnpm-lock.yaml` antes del primer push. |

---

## Verificación end-to-end

Después del deploy + subdominio + CORS:

1. `https://<subdominio>/cyber` carga ranking público con datos reales de ored. Sin errores en consola.
2. `https://<subdominio>/` muestra el dashboard interno con loader, luego data. Si Supabase tiene un usuario admin autorizado, puede loguearse.
3. Recargar en `/cyber/foo` (cualquier ruta inventada) → muestra el `/cyber` (porque path-switch en `main.jsx` matchea `/cyber/*`). NO debe ser 404.
4. `pnpm build` local en la máquina del usuario produce un `dist/` que pesa similar al de Vercel (sanity check de paridad).
5. Test de coordinador real: alguien con email en `VITE_ADMIN_EMAILS` puede loguearse y guardar una promesa. (Esto requiere completar F0.5 y F2.2 del plan F1-F4 para que el sync remoto funcione, pero el lock client-side ya debería funcionar con esta config.)

---

## Acciones pendientes después de deploy

- Una vez en producción Vercel, **actualizar este documento** con el subdominio definitivo y el deploy URL `.vercel.app`.
- Coordinar con backend ored la CORS allowlist (mensaje al equipo).
- Comunicar al equipo de coordinadores: nuevo URL del dashboard, fecha de cutover.
- **Mantener el plan F1-F4** (`docs/` con la auditoría) en paralelo: el deploy NO arregla los bugs C1/C2/C4. Esos siguen viajando al deploy productivo hasta que se mergeen los fixes.
