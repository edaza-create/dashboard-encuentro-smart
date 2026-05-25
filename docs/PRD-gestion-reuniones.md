# PRD — Gestión de Reuniones y Generación de QR

| Campo | Valor |
|-------|--------|
| **Versión** | 1.0 |
| **Fecha** | 25 mayo 2026 |
| **Estado** | Listo para implementación |
| **Repositorio** | Dashboard Encuentro Smart |
| **Alcance** | CRUD de reuniones desde el dashboard admin + QR por reunión + monitoreo en vivo + reporte post-reunión |
| **Relacionado** | `PRD-asistencia-qr-reuniones.md` (flujo del asesor y puntos), `src/features/asistencia/AsistenciaPage.jsx` (vista actual a reemplazar/extender) |

---

## 1. Resumen ejecutivo

El admin necesita un módulo completo para **crear, activar, monitorear y cerrar reuniones**, donde cada reunión genera un QR que los asesores escanean para registrar su asistencia.

Este PRD cubre exclusivamente la **gestión del lado admin**: ciclo de vida de la reunión, interfaz de CRUD, generación de QR, monitoreo en tiempo real y reporte post-reunión.

El flujo del asesor (formulario QR) y el cálculo de puntos están en `PRD-asistencia-qr-reuniones.md`.

---

## 2. Ciclo de vida de una reunión

```
┌──────────┐    genera QR    ┌──────────┐   35 min / cierre manual   ┌──────────┐
│  BORRADOR │ ─────────────► │  ACTIVA  │ ─────────────────────────► │  CERRADA │
│ (sin QR) │                 │ (abierta)│                             │          │
└──────────┘                 └──────────┘                             └──────────┘
     │                            │                                        │
     │ eliminar                   │ cierre manual anticipado               │ archivar
     ▼                            ▼                                        ▼
 [eliminada]                  [CERRADA]                               [archivada]
```

| Estado | Descripción | Acepta registros | QR válido | Editable |
|--------|-------------|-----------------|-----------|----------|
| **BORRADOR** | Creada pero sin QR generado | No | No | Sí (todos los campos) |
| **ACTIVA** | QR generado, contador corriendo | Sí | Sí (por 35 min) | Solo nombre |
| **CERRADA** | Tiempo agotado o cierre manual | No | No (redirige a "cerrada") | No |
| **ARCHIVADA** | Admin la quitó de la vista activa | No | No | No |

### Reglas de transición

- **BORRADOR → ACTIVA:** el admin hace clic en "Generar QR". Se registra `qr_generated_at = now()`. `closes_at = qr_generated_at + 35 min`.
- **ACTIVA → CERRADA automático:** cuando `now() > closes_at` (verificado en cliente con countdown + RLS en DB).
- **ACTIVA → CERRADA manual:** admin hace clic en "Cerrar ahora". Útil si la reunión terminó antes.
- **CERRADA → ARCHIVADA:** admin archiva para limpiar la lista. Los datos se conservan.
- **BORRADOR → eliminada:** solo si no tiene asistencias registradas (en borrador nunca tiene, ya que requiere QR activo para registrar).
- **CERRADA → eliminada:** solo si no tiene asistencias (edge case: reunión cerrada sin nadie).

### ¿Se puede regenerar el QR?

Sí, pero con condición: si la reunión está **CERRADA** y el admin quiere **reabrir** (ej. error, se acabó antes), puede generar un nuevo QR. Esto crea un **nuevo período de 35 min** y resetea `qr_generated_at`. Los registros anteriores **se conservan** (no se borran al reabrir).

---

## 3. Modelo de datos (SQL definitivo)

```sql
CREATE TABLE public.asistencia_reuniones_config (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text    NOT NULL,
  descripcion      text,
  fecha_evento     date,                    -- fecha de la reunión (puede diferir de created_at)
  tipo             text    DEFAULT 'general'
                   CHECK (tipo IN ('general', 'kickoff', 'cierre', 'semanal', 'especial')),
  qr_generated_at  timestamptz,             -- NULL = borrador
  closes_at        timestamptz GENERATED ALWAYS AS
                     (qr_generated_at + interval '35 minutes') STORED,
  cerrada_manual   boolean DEFAULT false,
  archivada        boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  created_by       text,                    -- email del admin
  updated_at       timestamptz DEFAULT now()
);

-- Estado derivado (no almacenado, calculado en queries y cliente)
-- 'borrador'  : qr_generated_at IS NULL AND NOT archivada
-- 'activa'    : qr_generated_at IS NOT NULL AND closes_at > now() AND NOT cerrada_manual AND NOT archivada
-- 'cerrada'   : (closes_at <= now() OR cerrada_manual) AND NOT archivada
-- 'archivada' : archivada = true

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_reuniones_updated_at
  BEFORE UPDATE ON asistencia_reuniones_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

```sql
CREATE TABLE public.asistencia_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id    uuid NOT NULL REFERENCES asistencia_reuniones_config(id) ON DELETE CASCADE,
  email         text NOT NULL,
  nombre        text,
  bp_slug       text,
  equipo_id     int,
  equipo_label  text,
  modalidad     text NOT NULL CHECK (modalidad IN ('Presencial', 'Online')),
  registrado_en timestamptz DEFAULT now(),
  UNIQUE (reunion_id, email)
);

-- Vista de conteos para anon (sin emails)
CREATE OR REPLACE VIEW public.asistencia_conteo_por_equipo AS
  SELECT
    reunion_id,
    equipo_id,
    equipo_label,
    modalidad,
    count(*) AS total
  FROM asistencia_registros
  GROUP BY reunion_id, equipo_id, equipo_label, modalidad;
```

---

## 4. Interfaz de administración — vistas y componentes

### 4.1 Pantalla principal — Lista de reuniones

**Ruta:** Tab "Asistencia reuniones" en el dashboard (ya existe en `AppSidebar`)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Asistencia Reuniones                         [+ Nueva reunión]     │
│                                                                     │
│  ┌─ Filtros ──────────────────────────────────────────────────────┐ │
│  │  Estado: [Todas ▼]   Tipo: [Todos ▼]   Fecha: [hoy / rango]   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ── ACTIVAS ────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🟢 Kick-off Norte Verde    General · hoy 15:00               │  │
│  │    ████████░░░░  QR expira en 22:15   42 asistentes          │  │
│  │    [Ver en vivo]  [Cerrar ahora]  [Descargar QR]             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── BORRADOR ───────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ⚪ Reunión semanal BPs Sur   Semanal · 26 may 2026           │  │
│  │    Sin QR generado                                           │  │
│  │    [Generar QR]  [Editar]  [Eliminar]                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── CERRADAS (últimas 5) ──────────────────────────────────────── │
│  │ 🔴 Reunión semanal 19 may   38 asistentes   +75 pts           │  │
│  │    [Ver reporte]  [Reabrir]  [Archivar]                       │  │
│  └────────────────────────────────────────────────────────────── │  │
└─────────────────────────────────────────────────────────────────────┘
```

**Comportamiento de la lista:**
- Secciones colapsables: **Activas** (arriba siempre), **Borrador**, **Cerradas** (últimas 10), **Archivadas** (ocultas por defecto, toggle).
- Polling cada **15 segundos** en reuniones activas para actualizar conteo y countdown.
- Badge de color: verde (activa), gris (borrador), rojo (cerrada), azul (archivada).
- Countdown en tiempo real con `setInterval` en el cliente mientras hay reuniones activas.

---

### 4.2 Modal — Crear / Editar reunión

Abre al hacer clic en "**+ Nueva reunión**" o "**Editar**".

```
┌──────────────────────────────────────────────────────┐
│  Nueva reunión                                   [✕] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Nombre *                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ Kick-off Norte Verde                           │  │
│  └────────────────────────────────────────────────┘  │
│  Hasta 60 caracteres. Aparece en el formulario del   │
│  asesor al escanear el QR.                           │
│                                                      │
│  Tipo de reunión                                     │
│  ○ General  ○ Kick-off  ○ Cierre  ○ Semanal  ○ Especial │
│                                                      │
│  Fecha del evento                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ 26/05/2026                                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Descripción (opcional)                              │
│  ┌────────────────────────────────────────────────┐  │
│  │ Reunión de apertura del período junio…         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⚠ El QR se genera en un paso separado.             │
│    Esta reunión quedará en estado BORRADOR.          │
│                                                      │
│              [Cancelar]  [Crear reunión →]           │
└──────────────────────────────────────────────────────┘
```

**Campos:**

| Campo | Requerido | Validación | Editable en ACTIVA |
|-------|-----------|------------|-------------------|
| Nombre | Sí | 3–60 chars | Sí |
| Tipo | No | enum | No |
| Fecha del evento | No | fecha válida | No |
| Descripción | No | max 200 chars | No |

**Regla de edición en estado ACTIVA:** solo el nombre es editable. El resto está bloqueado con tooltip "No editable mientras la reunión está activa".

---

### 4.3 Vista de generación de QR

Al hacer clic en **"Generar QR"** desde la tarjeta de borrador, abre un modal o pantalla:

```
┌──────────────────────────────────────────────────────────┐
│  Generar QR — Kick-off Norte Verde               [✕]     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ⚠ Una vez generado, el QR dura 35 minutos.       │  │
│  │  ¿Estás seguro de que la reunión está por comenzar? │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  URL que recibirán los asesores:                         │
│  https://tudominio.com/asistencia?reunion=<uuid>         │
│                                                          │
│            [Cancelar]  [Confirmar y generar QR →]        │
└──────────────────────────────────────────────────────────┘
```

Una vez confirmado, **abre el panel QR activo**:

```
┌──────────────────────────────────────────────────────────┐
│  QR Activo — Kick-off Norte Verde                        │
│  Cierra en: 🕐 34:52  ████████████████████░░  [Cerrar ahora] │
├────────────────────────┬─────────────────────────────────┤
│                        │                                 │
│   ██████████████████   │  📡 En vivo                     │
│   ██  ██  ████  ████   │                                 │
│   ██  ██  ████  ████   │  Total asistentes: 12           │
│   ██████████████████   │  ├─ Presencial: 7               │
│   ████  ██  ██  ████   │  └─ Online: 5                   │
│   ██████████████████   │                                 │
│                        │  Por equipo:                    │
│  [🖨 Imprimir]         │  Team Williams   5/28  (18%)    │
│  [⬇ Descargar PNG]     │  Team Jordan     4/22  (18%)    │
│  [📋 Copiar URL]       │  Team …          3/19  (16%)    │
│                        │                                 │
│                        │  🏆 Umbrales cruzados: ninguno  │
└────────────────────────┴─────────────────────────────────┘
```

**Detalles del panel QR activo:**
- El QR se genera con la librería `qrcode.react` (no requiere servidor).
- Countdown en tiempo real: `HH:MM` actualizando cada segundo con `setInterval`.
- Barra de progreso visual del tiempo restante.
- Panel derecho actualiza cada 15 s con conteo de asistentes.
- Cuando un equipo cruza cualquier umbral → esa fila cambia a verde con badge "🏆 +15 pts".
- El modal/vista se puede cerrar sin afectar la reunión activa (sigue corriendo).

---

### 4.4 Vista "En vivo" — Monitoreo durante la reunión

Accesible desde "Ver en vivo" en la tarjeta de reunión activa. Pantalla completa o panel grande.

```
┌─────────────────────────────────────────────────────────────────────┐
│  En vivo — Kick-off Norte Verde            Cierra en: 🕐 22:08      │
│  Actualizado hace 8s  [⟳]              [Cerrar ahora]               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Asistentes: 42  |  Presencial: 25  |  Online: 17                  │
│                                                                     │
│  EQUIPOS                                                            │
│  ┌──────────────────┬───────┬────────────┬────────────┬──────────┐  │
│  │ Equipo           │ Total │ Presencial │  Online    │ Puntos   │  │
│  ├──────────────────┼───────┼────────────┼────────────┼──────────┤  │
│  │ Team Williams    │ 12/28 │ 8 (43%)    │ 4 (14%)    │  —       │  │
│  │ Team Jordan      │ 10/22 │ 7 (32%)    │ 3 (14%)    │  —       │  │
│  │ Team Federer     │  9/19 │ 5 (26%)  🟡│ 4 (21%)    │  —       │  │
│  │ Team Nadal       │  7/15 │ 3 (20%)    │ 4 (27%)    │  —       │  │
│  │ Team Djokovic    │  4/18 │ 2 (11%)    │ 2 (11%)    │  —       │  │
│  └──────────────────┴───────┴────────────┴────────────┴──────────┘  │
│                                                                     │
│  🟡 = cerca del umbral (≥ 70% del requerido)                        │
│                                                                     │
│  ASESORES                                                           │
│  ┌────────────────────────────┬───────────────┬────────────┬──────┐  │
│  │ Nombre                     │ BP            │ Equipo     │ Mod. │  │
│  ├────────────────────────────┼───────────────┼────────────┼──────┤  │
│  │ Katherine Lettich          │ Equipo Interno│ —          │  🖥  │  │
│  │ Adriana Hernández          │ Vanema        │ Williams   │  🏢  │  │
│  │ …                          │               │            │      │  │
│  └────────────────────────────┴───────────────┴────────────┴──────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Indicadores visuales:**
- 🟡 Fila amarilla: equipo está entre 70%–99% del umbral (cerca de cruzarlo).
- 🟢 Fila verde: umbral cruzado, puntos otorgados.
- Íconos modalidad: 🏢 Presencial / 🖥 Online.
- La tabla de asesores es solo para admin (requiere `authenticated`).

---

### 4.5 Vista de reporte post-reunión

Accesible desde "Ver reporte" en reuniones cerradas.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Reporte — Kick-off Norte Verde                                     │
│  19 may 2026 · Duración: 35 min · Cerrada automáticamente          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RESUMEN                                                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│  │ 42           │ 25           │ 17           │ 75 pts       │     │
│  │ Asistentes   │ Presencial   │ Online       │ Pts otorgados│     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘     │
│                                                                     │
│  PUNTOS POR EQUIPO                                                  │
│  ┌─────────────────┬──────┬────────────┬───────────┬──────────┐    │
│  │ Equipo          │ Rostr│ Presencial │ Online    │ Puntos   │    │
│  ├─────────────────┼──────┼────────────┼───────────┼──────────┤    │
│  │ ✅ Team Williams │  28  │ 15 (54%) ✓ │ 7 (25%)   │ +15 pts  │    │
│  │ ✅ Team Jordan   │  22  │  5 (23%)   │18 (82%) ✓ │ +15 pts  │    │
│  │ ❌ Team Federer  │  19  │  5 (26%)   │ 4 (21%)   │ 0 pts    │    │
│  │ ❌ Team Nadal    │  15  │  2 (13%)   │ 3 (20%)   │ 0 pts    │    │
│  │ ✅ Team Djokovic │  18  │  4 (22%)   │15 (83%) ✓ │ +15 pts  │    │
│  └─────────────────┴──────┴────────────┴───────────┴──────────┘    │
│                                                                     │
│  ✓ = umbral cruzado   ✅ = equipo obtuvo puntos                     │
│                                                                     │
│  ASISTENTES (42)                                                    │
│  [tabla completa con nombre / BP / equipo / modalidad / hora reg.]  │
│                                                                     │
│  AUSENTES DETECTADOS (asesores activos sin registro)                │
│  [lista de asesores con email en maestra que no aparecen]           │
│                                                                     │
│     [⬇ Exportar CSV]   [Reabrir reunión]   [Archivar]              │
└─────────────────────────────────────────────────────────────────────┘
```

**Sección "Ausentes detectados":**
- Cruzar `asesores-bp.json` (estado ACTIVO) contra `asistencia_registros` de esa reunión.
- Mostrar nombre + BP de quienes no registraron.
- Útil para seguimiento posterior.
- Solo visible para admin.

---

## 5. Flujo completo de una reunión (paso a paso)

```
Admin crea reunión
  │
  ▼
[BORRADOR] ──── admin ve tarjeta con [Generar QR] / [Editar] / [Eliminar]
  │
  │ admin hace clic "Generar QR" → confirmación → qr_generated_at = now()
  ▼
[ACTIVA] ──── QR mostrado en pantalla
  │            └─ admin puede: imprimir, descargar PNG, copiar URL
  │            └─ asesores escanean, se registran
  │            └─ panel "En vivo" muestra asistentes en tiempo real
  │            └─ si equipo cruza umbral → banner en formulario del asesor
  │                                      → fila verde en panel admin
  │
  │ (35 minutos después) closes_at < now()
  │ O admin hace clic "Cerrar ahora"
  ▼
[CERRADA] ──── puntos ya otorgados, no se aceptan más registros
  │            └─ admin ve "Ver reporte" con resumen completo
  │            └─ [Reabrir] genera nuevo qr_generated_at (35 min más)
  │            └─ [Archivar] la quita de la lista principal
  ▼
[ARCHIVADA] ──── solo visible en sección "Archivadas" (colapsada)
```

---

## 6. Funcionalidades del módulo

### 6.1 CRUD de reuniones

| Operación | Estado permitido | Quién | Notas |
|-----------|-----------------|-------|-------|
| Crear | — | Admin | Siempre disponible |
| Editar nombre | BORRADOR, ACTIVA | Admin | Solo nombre en ACTIVA |
| Editar tipo/fecha | BORRADOR | Admin | Bloqueado en ACTIVA y CERRADA |
| Eliminar | BORRADOR, CERRADA sin asistencias | Admin | Con confirmación |
| Generar QR | BORRADOR, CERRADA (reabrir) | Admin | Con confirmación |
| Cerrar manual | ACTIVA | Admin | Con confirmación |
| Archivar | CERRADA | Admin | Reversible |

### 6.2 QR

| Característica | Detalle |
|----------------|---------|
| Librería | `qrcode.react` (client-side, sin servidor) |
| Contenido del QR | `https://<dominio>/asistencia?reunion=<uuid>` |
| Tamaño recomendado | 300×300 px mínimo para impresión |
| Descarga | PNG via canvas `toDataURL()` |
| Impresión | `window.print()` con CSS `@media print` |
| Nivel de corrección de errores | M (15%) — balance entre tamaño y tolerancia |
| ¿Cambia el QR al reabrir? | No — el UUID de la reunión es fijo; lo que cambia es `qr_generated_at`. El mismo QR impreso sirve para la próxima sesión. |

### 6.3 Monitoreo en tiempo real

| Dato | Frecuencia de actualización | Fuente |
|------|-----------------------------|--------|
| Contador de asistentes | 15 s (polling) | `asistencia_registros` COUNT |
| Breakdown por equipo | 15 s (polling) | `asistencia_conteo_por_equipo` VIEW |
| Countdown del QR | 1 s (setInterval local) | Calculado desde `closes_at` |
| Umbral cruzado (admin) | 15 s (polling) | `buildAsistenciaPuntos()` en cliente |

> Supabase Realtime (subscripción a `postgres_changes`) es una mejora futura opcional — el polling de 15 s es suficiente para el MVP y requiere menos configuración de RLS.

### 6.4 Notificaciones al admin cuando se cruza un umbral

- La fila del equipo en el panel "En vivo" cambia a fondo verde con badge **+15 pts**.
- Si el admin tiene la lista de reuniones visible (no el panel en vivo), el contador en la tarjeta de la reunión activa muestra un 🏆 badge con el número de umbrales cruzados.
- No se envían emails ni push notifications en el MVP (puede agregarse vía Supabase pg_notify en v2).

### 6.5 Exportación

- **CSV** desde la vista de reporte post-reunión.
- Columnas: `nombre, email, bp_slug, equipo_label, modalidad, registrado_en`.
- Descarga client-side con `Blob` + `URL.createObjectURL()`.
- No requiere servidor.

### 6.6 Reuniones simultáneas

**¿Pueden existir dos reuniones activas al mismo tiempo?**

Sí — no hay restricción técnica. Ejemplo: una reunión para BPs del norte y otra para BPs del sur en paralelo. Cada asistencia se vincula a `reunion_id` específico.

El admin verá ambas tarjetas en la sección "Activas" con sus respectivos countdowns.

Los puntos se calculan por separado por `reunion_id` — no hay interferencia entre reuniones.

---

## 7. Arquitectura de componentes

```
src/
  features/
    asistenciaAdmin/
      AsistenciaAdminPage.jsx         ← reemplaza AsistenciaPage.jsx actual
      components/
        ReunionCard.jsx               ← tarjeta en lista (borrador/activa/cerrada)
        ReunionForm.jsx               ← modal crear/editar
        QRGenerarConfirm.jsx          ← modal de confirmación antes de generar QR
        QRActivoPanel.jsx             ← panel QR + countdown + conteo en vivo
        ReunionEnVivoPanel.jsx        ← monitoreo detallado durante reunión
        ReunionReporte.jsx            ← reporte post-reunión
        AusentesLista.jsx             ← tabla de ausentes detectados
        ExportarCSVButton.jsx         ← descarga client-side
      AsistenciaAdminPage.module.css
  api/
    reunionesAdmin.js                 ← createReunion, updateReunion, generateQR,
                                         closeReunion, archiveReunion, deleteReunion
    asistenciaRemote.js               ← fetchAsistencias, fetchConteos, fetchAwards
  hooks/
    useReunionesAdmin.js              ← lista + polling + optimistic updates
    useReunionEnVivo.js               ← polling 15s para conteos durante reunión activa
    useCountdown.js                   ← setInterval para countdown del QR
  utils/
    buildAsistenciaPuntos.js          ← calcula % y puntos por equipo por reunión
    buildRosterPorEquipo.js           ← denominador: asesores activos por equipo
    ausentes.js                       ← cruce maestra vs registros para detectar ausentes
```

---

## 8. Modelo de puntos — integración con scoring existente

Los puntos de asistencia son **adicionales** a los `actividadOnlineCount` / `actividadPresencialCount` que el admin registra manualmente:

```
totalPuntosEquipo =
  puntosReservas (automático desde ored)
  + puntosPromesas (manual admin)
  + puntosEscrituras (manual admin)
  + puntosActividadesManuales (actividadOnlineCount * 15 + actividadPresencialCount * 15)
  + puntosAsistencia (Σ +15 por cada reunión donde se cruzó umbral)
                      ↑ calculado por buildAsistenciaPuntos()
```

`buildAsistenciaPuntos()` retorna `{ [equipo_id]: number }` con el total acumulado de puntos de asistencia a través de todas las reuniones.

### Reglas de umbrales (confirmadas)

| Condición sobre el equipo en una reunión | Puntos |
|------------------------------------------|--------|
| ≥ 80 % de asesores activos del equipo registraron **Online** | +15 pts |
| ≥ 50 % de asesores activos del equipo registraron **Presencial** | +15 pts |
| Ambos umbrales en la misma reunión | +30 pts |
| Ningún umbral | 0 pts |

**Denominador:** total de asesores con `estado = 'ACTIVO'` en `asesores-bp.json` cuyo `bp_slug` pertenece a ese equipo **más** los miembros del `equipoComercialInterno` que correspondan al equipo.

---

## 9. RLS completo

```sql
-- TABLA: asistencia_reuniones_config
ALTER TABLE asistencia_reuniones_config ENABLE ROW LEVEL SECURITY;

-- Anon puede leer (necesita nombre para mostrar en el formulario QR)
CREATE POLICY "anon lee reuniones" ON asistencia_reuniones_config
  FOR SELECT TO anon USING (true);

-- Admin (authenticated) full access
CREATE POLICY "admin crud reuniones" ON asistencia_reuniones_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLA: asistencia_registros
ALTER TABLE asistencia_registros ENABLE ROW LEVEL SECURITY;

-- Anon puede insertar solo si la reunión está activa ahora
CREATE POLICY "anon inserta asistencia" ON asistencia_registros
  FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM asistencia_reuniones_config r
      WHERE r.id = reunion_id
        AND r.qr_generated_at IS NOT NULL
        AND r.closes_at > now()
        AND NOT r.cerrada_manual
    )
  );

-- Anon NO puede leer registros individuales (protección de emails)
CREATE POLICY "anon bloqueado lectura registros" ON asistencia_registros
  FOR SELECT TO anon USING (false);

-- Admin lee todo
CREATE POLICY "admin lee registros" ON asistencia_registros
  FOR SELECT TO authenticated USING (true);

-- VIEW: asistencia_conteo_por_equipo
-- La view hereda RLS de la tabla base cuando se usa SECURITY INVOKER (default)
-- Para anon: GRANT SELECT en la view, no en la tabla.
GRANT SELECT ON asistencia_conteo_por_equipo TO anon;
```

---

## 10. Plan de implementación

### Fase 1 — SQL y estructura (0.5 día)
- [ ] Crear `docs/supabase-asistencia-qr.sql` con el DDL completo del §3 y §9
- [ ] Ejecutar en Supabase SQL Editor
- [ ] Verificar RLS con curl: anon puede leer reuniones, no puede leer registros individuales, sí puede insertar en reunión activa

### Fase 2 — API client y hooks (0.5 día)
- [ ] `src/api/reunionesAdmin.js` — CRUD + generateQR + close + archive + delete
- [ ] `src/api/asistenciaRemote.js` — fetchAsistencias, fetchConteos
- [ ] `src/hooks/useReunionesAdmin.js` — lista con polling 15 s
- [ ] `src/hooks/useCountdown.js` — countdown por `closes_at`
- [ ] `src/utils/buildRosterPorEquipo.js`
- [ ] `src/utils/buildAsistenciaPuntos.js`
- [ ] `src/utils/ausentes.js`

### Fase 3 — UI lista de reuniones + CRUD (1 día)
- [ ] `AsistenciaAdminPage.jsx` con secciones Activas / Borrador / Cerradas / Archivadas
- [ ] `ReunionCard.jsx` con acciones contextuales según estado
- [ ] `ReunionForm.jsx` (modal crear/editar)
- [ ] `QRGenerarConfirm.jsx` (modal confirmación)
- [ ] Conectar en `App.jsx` reemplazando tab actual

### Fase 4 — Panel QR activo y monitoreo en vivo (1 día)
- [ ] `QRActivoPanel.jsx` con `qrcode.react` + countdown + conteo live
- [ ] Descarga PNG y copiar URL
- [ ] `ReunionEnVivoPanel.jsx` con tabla de equipos y asesores
- [ ] Indicadores visuales de umbral (amarillo → verde)

### Fase 5 — Reporte post-reunión + integración scoring (1 día)
- [ ] `ReunionReporte.jsx` con breakdown completo
- [ ] `AusentesLista.jsx`
- [ ] `ExportarCSVButton.jsx`
- [ ] Integrar `buildAsistenciaPuntos()` en `CompetenciaCapitalOneTab.jsx` y en el scoring de `/cyber`

### Fase 6 — QA (0.5 día)
- [ ] Test completo del ciclo: crear → generar QR → registrar asistentes → esperar 35 min → ver reporte
- [ ] Test de umbrales con datos controlados
- [ ] Test de reuniones simultáneas
- [ ] Verificar que `/cyber` refleja puntos

**Total estimado: 4,5 días hábiles**

---

## 11. Criterios de aceptación

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| CA-01 | Admin crea reunión "Kick-off Norte" sin generar QR | Estado BORRADOR, no aparece URL pública |
| CA-02 | Admin genera QR para reunión en BORRADOR | QR visible, countdown de 35 min comienza, estado ACTIVA |
| CA-03 | Asesor escanea QR dentro de los 35 min | Formulario carga con nombre de la reunión |
| CA-04 | Asesor escanea QR después de 35 min | Mensaje "Esta reunión ya cerró" |
| CA-05 | Admin cierra reunión manualmente antes de 35 min | Estado CERRADA, QR inválido inmediatamente |
| CA-06 | Admin reabre reunión cerrada | Nuevo período de 35 min, mismo QR (mismo UUID) |
| CA-07 | Admin edita nombre en reunión ACTIVA | Nombre actualizado, tipo/fecha bloqueados |
| CA-08 | Admin intenta eliminar reunión con asistencias | Error "No se puede eliminar con asistentes registrados" |
| CA-09 | Equipo cruza umbral 80% online | Fila verde en panel admin + badge 🏆 en tarjeta |
| CA-10 | Admin descarga QR como PNG | Imagen legible con cámara de móvil |
| CA-11 | Admin exporta CSV del reporte | Archivo con todos los campos, sin datos de otros asistentes |
| CA-12 | Dos reuniones activas simultáneas | Cada una tiene su countdown y conteos independientes |
| CA-13 | Reporte muestra ausentes correctamente | Lista cruza maestra activa vs registros de esa reunión |
| CA-14 | Puntos de asistencia en `/cyber` | Ranking público refleja los +15 pts acumulados |

---

## 12. Decisiones de UX ya tomadas

| Pregunta | Decisión |
|----------|----------|
| ¿El QR cambia al reabrir una reunión? | No — el UUID es fijo. El mismo QR impreso sirve para reabrir |
| ¿El asesor puede corregir modalidad? | No — una sola entrada por asesor por reunión |
| ¿El formulario muestra progreso del equipo? | No — solo banner cuando el umbral YA se cruzó |
| ¿El umbral se evalúa al cerrar o en tiempo real? | En tiempo real — los puntos se acumulan desde el momento en que se cruza |
| ¿El Equipo Comercial Interno cuenta en el denominador? | Sí |
| Cada reunión suma puntos independientemente | Sí — acumulativo |

---

## 13. Preguntas abiertas (v2 / no bloquean MVP)

| # | Pregunta |
|---|----------|
| V2-01 | ¿Notificaciones push al admin (email / Slack) cuando se cruza un umbral? |
| V2-02 | ¿Plantillas de reunión para reuniones recurrentes semanales? |
| V2-03 | ¿Límite de reuniones activas simultáneas (ej. max 3)? |
| V2-04 | ¿Supabase Realtime en lugar de polling para actualización instantánea? |
| V2-05 | ¿Historial de reaperturas por reunión (log de `qr_generated_at` anteriores)? |
| V2-06 | ¿Vista comparativa entre reuniones (progresión de asistencia semana a semana)? |

---

## 14. Referencias

| Tema | Archivo |
|------|---------|
| Flujo del asesor + cálculo de puntos | `docs/PRD-asistencia-qr-reuniones.md` |
| Scoring existente | `src/utils/competenciaCapitalOpenScore.js` |
| Tab Asistencia actual (a reemplazar) | `src/features/asistencia/AsistenciaPage.jsx` |
| Maestra de asesores | `src/data/asesores-bp.json` |
| Equipos Capital Open | `src/data/competenciaCapitalOneTeams.js` |
| Patrón Supabase anon | `src/api/competenciaManualRemote.js` |
| SQL de competencia manual | `docs/supabase-competencia-manual.sql` |
