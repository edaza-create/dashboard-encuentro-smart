# Deploy — Opción B: puntos manuales vía Supabase

Checklist para publicar competencia (promesas / escrituras) en `/cyber` sin depender del mismo navegador.

---

## 1. Supabase (una vez)

1. Abrir el proyecto Supabase del dashboard.
2. **SQL Editor** → pegar y ejecutar `docs/supabase-competencia-manual.sql`.
3. Verificar tabla `encuentro_competencia_manual` con filas posibles `individual` y `team`.
4. **Authentication** → asegurar OTP por correo activo para admins.

---

## 2. Variables de entorno

Configurar en **local** (`.env`) y en **GitHub / hosting** (secrets del deploy):

| Variable | Dashboard `/` | Público `/cyber` |
|----------|---------------|------------------|
| `SUPABASE_URL` | ✅ | ✅ |
| `SUPABASE_ANON_KEY` | ✅ | ✅ |
| `VITE_ADMIN_EMAILS` | ✅ (recomendado) | — |
| `VITE_CYBER_MANUAL_POLL_MS` | opcional | ✅ (`15000`) |
| `VITE_API_BASE_URL` | — | ✅ |
| `VITE_CYBER_DESDE` / `VITE_CYBER_HASTA` | — | ✅ |

> Vite expone `SUPABASE_*` al cliente (`vite.config.js` → `envPrefix`).

---

## 3. Build y deploy (GitHub)

```bash
npm run build
```

Subir `dist/` al hosting (o pipeline CI que inyecte las variables anteriores en **build time**).

Rutas:

- Dashboard admin: `/`
- Ranking público: `/cyber`

---

## 4. Operación día del Cyber

1. Coordinador abre el **dashboard** e **inicia sesión** (correo en `VITE_ADMIN_EMAILS`).
2. Pestaña **Competencia Capital Open Individual** → editar → **Guardar** por asesor.
3. Banner verde: “Cambios publicados en /cyber” (o usar **Publicar todo en /cyber** si había datos solo en local).
4. Abrir `/cyber` en otro navegador o dispositivo → en ~15 s deben verse los mismos totales.

**Sin sesión:** los cambios quedan solo en ese navegador; el público no los verá.

---

## 5. Pruebas de aceptación

| # | Paso | OK |
|---|------|-----|
| AC-01 | Guardar +1 promesa (Chrome admin logueado) → `/cyber` en Safari | ☐ |
| AC-02 | Cerrar admin; solo `/cyber` abierto → datos persisten | ☐ |
| AC-03 | “Publicar todo en /cyber” con datos previos en localStorage | ☐ |
| AC-04 | Admin sin login → banner pide iniciar sesión | ☐ |

---

## 6. Cierre post-Cyber

- Exportar filas de `encuentro_competencia_manual` (backup).
- Opcional: eliminar tabla o desactivar políticas RLS.
- Archivar repositorio / quitar secrets de CI.

---

Ver PRD completo: `docs/PRD-competencia-manual-sync.md`
