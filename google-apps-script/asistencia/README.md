# Google Apps Script — Asistencia reuniones

## Propiedades del script

| Clave | Valor |
|-------|--------|
| `WEBHOOK_URL` | `https://<TU_PROJECT>.supabase.co/functions/v1/forms-asistencia` |
| `WEBHOOK_SECRET` | Mismo secreto que `FORMS_WEBHOOK_SECRET` en Supabase |

## Despliegue backend (una vez)

1. SQL: `docs/supabase-asistencia-reunion.sql`
2. `npm run sync:asesores` (maestra actualizada)
3. `node scripts/copy-maestra-to-functions.mjs`
4. Supabase CLI: `supabase secrets set FORMS_WEBHOOK_SECRET=...`
5. `supabase functions deploy forms-asistencia`

## Qué hace el webhook

1. Guarda la asistencia (`reunion` + `email` únicos).
2. Recalcula % por **equipo Capital Open**.
3. Si ≥80% online → +1 `actividadOnlineCount` (+15 pts).
4. Si ≥50% presencial → +1 `actividadPresencialCount` (+15 pts).
5. Publica en `encuentro_competencia_manual` scope `team` (visible en `/cyber`).

## Probar sin Form

```bash
curl -X POST "%WEBHOOK_URL%" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: %SECRET%" \
  -d "{\"timestamp\":\"19/05/2026 10:00:00\",\"email\":\"klettich@capitalinteligente.cl\",\"nombre\":\"Katherine Lettich\",\"modalidad\":\"Online\",\"reunion\":\"Prueba QA\"}"
```
