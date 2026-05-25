# Deploy — Google Forms → puntos de actividad (+15)

Checklist para que el flujo funcione en producción.

---

## 1. Supabase SQL (una vez)

En **SQL Editor**, ejecutar en orden:

1. `docs/supabase-competencia-manual.sql` (si no está hecho)
2. `docs/supabase-asistencia-reunion.sql`

---

## 2. Secretos y Edge Function

```bash
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <TU_PROJECT_REF>

# Secreto (mismo valor en Apps Script → WEBHOOK_SECRET)
supabase secrets set FORMS_WEBHOOK_SECRET=tu-secreto-largo-aleatorio

# Maestra actualizada
npm run sync:asesores
npm run build:maestra-index

# Desplegar función (JWT desactivado en supabase/config.toml)
supabase functions deploy forms-asistencia
```

URL del webhook:

```
https://<PROJECT_REF>.supabase.co/functions/v1/forms-asistencia
```

---

## 3. Google Apps Script

1. Abrir el proyecto del Form → **Extensiones** → **Apps Script**.
2. Reemplazar `onFormSubmit` con `google-apps-script/asistencia/Code.gs`.
3. **Configuración del proyecto** → **Propiedades del script**:

| Propiedad | Valor |
|-----------|--------|
| `WEBHOOK_URL` | URL de la función (arriba) |
| `WEBHOOK_SECRET` | Igual que `FORMS_WEBHOOK_SECRET` |

4. **Activadores** → Agregar → `onFormSubmit` → al enviar el formulario.

---

## 4. Dashboard `.env`

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
VITE_ASISTENCIA_POLL_MS=30000
```

Reiniciar `npm run dev`. Pestaña **Asistencia reuniones** debe listar registros.

---

## 5. Probar sin Form

```bash
# Windows PowerShell
$env:WEBHOOK_URL="https://xxx.supabase.co/functions/v1/forms-asistencia"
$env:WEBHOOK_SECRET="tu-secreto"
node scripts/test-forms-asistencia.mjs
```

O:

```bash
curl -X POST "%WEBHOOK_URL%" ^
  -H "Content-Type: application/json" ^
  -H "X-Webhook-Secret: %WEBHOOK_SECRET%" ^
  -d "{\"timestamp\":\"19/05/2026 10:00:00\",\"email\":\"klettich@capitalinteligente.cl\",\"nombre\":\"Katherine Lettich\",\"modalidad\":\"Online\",\"reunion\":\"QA Prueba\"}"
```

Respuesta esperada: `201` con `awardsGranted` (si el % del equipo cruza umbral).

---

## 6. Verificación

| # | Comprobación |
|---|----------------|
| 1 | Pestaña **Asistencia reuniones** muestra el registro |
| 2 | **Competencia Equipos** sube `actividadOnlineCount` o `actividadPresencialCount` |
| 3 | `/cyber` refleja puntos de equipo tras ~15 s |
| 4 | Email fuera de maestra → HTTP 404 en logs de la función |

---

Ver PRD: `docs/PRD-google-forms-asistencia.md`
