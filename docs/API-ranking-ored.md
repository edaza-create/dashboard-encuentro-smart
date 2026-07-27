# API pública de ranking — Encuentro Smart (ored)

Documentación del endpoint que alimenta el dashboard Capital Open y el ranking público `/cyber`.

> Verificado contra producción el **2026-07-27**. Los ejemplos y cifras de este documento salen de una llamada real, no del código.

---

## 1. Endpoint

```
GET https://ored.cl/api/public/encuentro-smart/ranking
```

| Parámetro | Obligatorio | Formato | Ejemplo |
| --- | --- | --- | --- |
| `desde` | sí | ISO 8601 con timezone | `2026-05-15T00:00:00-04:00` |
| `hasta` | sí | ISO 8601 con timezone | `2026-07-15T23:59:59-04:00` |
| `limit` | no | entero (default backend: 5000) | `1000` |

**Características actuales:**

- Público, sin autenticación ni headers de firma.
- Protegido por **allowlist de CORS** (puertos 5173 / 5174 / 5175 en desarrollo).
- Respuesta **cacheada ~60 s** en el servidor. Por eso el dashboard no hace polling agresivo (default: 30 min).

### Ejemplo de llamada

```bash
curl "https://ored.cl/api/public/encuentro-smart/ranking?desde=2026-05-15T00:00:00-04:00&hasta=2026-07-15T23:59:59-04:00"
```

En desarrollo local (`pnpm dev`) las llamadas van por proxy de Vite (`/api` → `ored.cl`) para evitar CORS.

---

## 2. Respuesta

```json
{
  "updated_at": "2026-07-27T20:35:59.368Z",
  "periodo": {
    "desde": "2026-05-15T04:00:00.000Z",
    "hasta": "2026-07-16T03:59:59.000Z"
  },
  "reservas": [ /* array de reservas */ ]
}
```

### Objeto `reserva` — 12 campos

```json
{
  "reserva_id": "689323f9-131f-4c86-8d82-49f2d5853080",
  "ocurrido_en": "2026-07-15T21:51:08.788219+00:00",
  "fecha": "2026-07-15",
  "hora": "17:51:08",
  "proyecto": "Compañia",
  "inmobiliaria": "Sento",
  "unidad": "Unidad 124 · Studio · piso 1",
  "monto_uf": 2658,
  "asesor_email": "cfarias@capitalinteligente.cl",
  "asesor_nombre": "Cristian Ariel Farias",
  "asesor_foto_url": "https://…/avatars/cfarias_…_400.png",
  "asesor_foto_urls": {
    "100": "https://…_100.png",
    "400": "https://…_400.png",
    "800": "https://…_800.png"
  }
}
```

| Campo | Tipo | Uso en el dashboard |
| --- | --- | --- |
| `reserva_id` | `string` (uuid) | **Identidad única.** Es la unidad de conteo |
| `ocurrido_en` | `string` (ISO 8601 UTC) | Timestamp completo; desempata la foto más reciente |
| `fecha` | `string` (`YYYY-MM-DD`) | **Filtro de ventana** del periodo |
| `hora` | `string` (`HH:mm:ss`) | Solo display |
| `proyecto` | `string` | Agrupación y display |
| `inmobiliaria` | `string` | Agrupación y display |
| `unidad` | `string` | Display; de aquí se extrae la tipología (Studio, 2D+1B…) |
| `monto_uf` | `number` | **Cartera UF** del asesor y del equipo |
| `asesor_email` | `string` | **Clave de agrupación.** Join con el roster de BPs |
| `asesor_nombre` | `string` | Etiqueta visible |
| `asesor_foto_url` | `string \| null` | Avatar (variante legacy, suele ser 400 px) |
| `asesor_foto_urls` | `object \| null` | Variantes por tamaño en px: `100`, `400`, `800` |

---

## 3. Estado actual de los datos

Llamada real al periodo del Cyber (15 may – 15 jul 2026):

```
416 reservas          416 reserva_id únicos       0 duplicados
0 sin asesor_email    0 sin fecha                 0 sin monto_uf
92 asesores distintos UF 1.454.527 acumuladas
Rango efectivo: 2026-05-15 → 2026-07-15
```

La API entrega datos limpios: sin duplicados ni campos nulos en el periodo consultado.

---

## 4. Cómo el dashboard usa estos datos

### Los 3 campos que importan para el conteo

1. **`reserva_id`** — 1 fila = 1 reserva. Se cuentan IDs distintos.
2. **`asesor_email`** — a quién se le atribuye. Se normaliza a minúsculas y se cruza con el roster (`src/data/asesores-bp.json`) para obtener su BP y su equipo.
3. **`monto_uf`** — alimenta la cartera UF individual y por equipo.

`fecha` solo se usa para filtrar la ventana; no se cuenta.

### Embudo de filtrado

| Etapa | Reservas | Qué hace |
| --- | --- | --- |
| Respuesta cruda de la API | 416 | Todo el periodo |
| Filtro de ventana | 416 | Por `fecha`, inclusive en ambos extremos |
| **Filtro de competencia** | **267** | Solo asesores cuyo BP está mapeado a un equipo |

Las ~149 restantes son de asesores cuyo BP **no participa** en la competencia Capital Open.

### Sistema de puntos

```
puntos = reservas × 15  +  promesas × 30  +  escrituras × 45
```

Promesas y escrituras **no vienen de esta API** — se cargan a mano en el dashboard admin y se sincronizan por Supabase.

---

## 5. ⚠️ Brecha detectada: no se puede distinguir una reserva caída

**Este es el punto que necesitamos resolver con el equipo de ored.**

### El problema

El endpoint **no expone ningún campo de estado**. Los 12 campos son los listados arriba y entre ellos no hay `estado`, `revertida`, `archivado`, `anulada` ni equivalente.

Consecuencia: **una reserva vigente y una reserva caída llegan idénticas.** El dashboard no tiene forma de distinguirlas, así que las cuenta todas y asigna puntos por reservas que ya no existen.

Esto se detectó porque en la plataforma ored las reservas caídas **sí** están marcadas, pero esa marca no sale por la API pública.

### Lo que necesitamos

Cualquiera de estas dos opciones resuelve el problema:

**Opción A — filtrar en el backend (preferida).**
Que el endpoint excluya las reservas caídas/revertidas/anuladas antes de responder. Cero cambios en el dashboard, y el ranking queda correcto de inmediato.

**Opción B — exponer el estado.**
Agregar el campo al objeto `reserva` para que el dashboard filtre. Basta con uno de estos:

```jsonc
{
  "reserva_id": "…",
  // …campos actuales…

  "estado": "Registrada",   // string: el estado real de la reserva
  "revertida": false        // boolean: true si se cayó
}
```

Si se toma la Opción B, conviene documentar los valores posibles de `estado` para saber cuáles cuentan y cuáles no.

### Nota de compatibilidad

Ambas opciones son **retrocompatibles**: agregar un campo no rompe al consumidor actual. El dashboard ya está preparado para leer `estado`, `revertida` y `archivado` si aparecen; hoy los recibe siempre vacíos y por eso los fuerza a "vigente".

### Alcance del impacto

Mientras esto no se resuelva, quedan afectados:

- El conteo de reservas por asesor y por equipo.
- Los puntos de competencia (15 pts por cada reserva caída que sigue contando).
- La cartera UF individual y por equipo.
- El ranking público `/cyber`.

---

## 6. Contacto y referencias

- **Consumidor:** dashboard Capital Open — `src/api/rankingClient.js`
- **Normalizador:** `src/utils/mapReserva.js` → `mapReservaPublica()`
- **Agregación:** `src/utils/buildRankingCompetencia.js`
- **Roster de asesores:** `src/data/asesores-bp.json` (join por email en minúsculas)

Variables de entorno relevantes:

```bash
VITE_API_BASE_URL=https://ored.cl
VITE_CYBER_DESDE=2026-05-15T00:00:00-04:00
VITE_CYBER_HASTA=2026-07-15T23:59:59-04:00
```
