# Reconciliación ORED ↔ Atlas — ventana Cyber

**Estado:** abierto. Bloquea el cambio de fuente del ranking a ORED.
**Medido:** 2026-07-28, ventana 2026-05-15 → 2026-07-15 (por fecha de reserva).

## El problema en una línea

Dos sistemas que deberían coincidir difieren en **79 reservas**, y ninguno de los
dos es superconjunto del otro.

| Caso | Cantidad | Qué significa |
| --- | --- | --- |
| `FALTA_EN_ATLAS` | 34 | ORED las tiene; Atlas nunca las ingirió |
| `FALTA_EN_ORED` | 33 | Atlas las tiene; el endpoint público de ORED no las devuelve |
| `ESTADO_DISCREPA` | 12 | ORED dice `Cancelado`, Atlas dice `Pendiente`/`created` |

Efecto en el ranking: ORED cuenta **332 vigentes**, Atlas cuenta **345**. Son 195
puntos y movimientos de puesto según qué fuente se use.

## Método (para que sea reproducible y discutible)

Comparar directamente los dos endpoints induce un falso positivo: **ORED filtra
por `ocurrido_en`** (cuándo entró la reserva al sistema) y **Atlas por
`fecha_reserva`** (fecha de negocio). Para neutralizarlo:

1. Se pidió a ambos una ventana ancha, 2026-04-01 → 2026-08-31.
2. Sobre esos resultados se recortó en cliente por `fecha` dentro de la ventana
   Cyber, así el criterio es idéntico en los dos lados.
3. Se cruzó por `ORED.reserva_id` == `Atlas.brekto_id` (verificado: 383 en común).

Con ventana ancha las diferencias **no desaparecen**, así que no son un artefacto
de fechas.

```bash
curl -s "https://ored.cl/api/public/encuentro-smart/ranking?desde=2026-04-01T00:00:00-04:00&hasta=2026-08-31T23:59:59-04:00&limit=20000" -o ored.json
curl -s "https://upygbobjarduunbwzeva.supabase.co/functions/v1/reservas-atlas?desde=2026-04-01&hasta=2026-08-31" -o atlas.json
# cruzar por reserva_id / brekto_id, recortando ambos por `fecha` en la ventana Cyber
```

---

## Caso 1 — 34 reservas que Atlas no tiene

**Para el equipo de Atlas.** Reservas presentes en ORED y ausentes en Atlas
incluso con ventana ancha: nunca se ingirieron. Sus estados en ORED:

```
Terminado 17 · Pendiente 8 · Procesando 6 · Cancelado 2 · Toma Unidad 1
```

No son de un solo día ni de una sola inmobiliaria, así que no parece una caída
puntual del webhook.

**Remedio candidato:** `atlasengine/scripts/backfill_reservas_ored.py`, que lee el
histórico de ORED y lo reprocesa con el mismo motor del webhook. Es idempotente
por `(brekto_id, estado)`.

```bash
python scripts/backfill_reservas_ored.py --dry-run     # primero, siempre
```

## Caso 2 — 33 reservas que ORED no devuelve

**Para Tomás / equipo ORED.** Presentes en Atlas y ausentes del endpoint público
aun con ventana ancha.

Se descartó que sean de asesores fuera de competencia: **31 de las 33 pertenecen
a asesores del roster** (`src/data/asesores-bp.json`), y su distribución por
inmobiliaria calca la del universo general (Euro 9, Aj Urbana 6, Viva 4, Grupo
Araucana 3, Imagina 2, Fundamenta 2). Estados en Atlas: 32 `Pendiente/created` y
1 `Cancelado/fallen`.

**Pregunta concreta:** ¿la vista `ranking_cyber_reservas_base` aplica algún filtro
—por inmobiliaria, por proyecto, por tipo de reserva— que las excluya a
propósito? Si es deliberado, hay que documentarlo porque cambia el alcance de la
competencia. Si no lo es, es un hueco de la vista.

## Caso 3 — 12 reservas con estado contradictorio

**Para el equipo de Atlas.** Todas en la misma dirección: ORED `Cancelado`, Atlas
`Pendiente`/`created`. Atlas nunca recibió el `reservation.fallen`.

```
brodriguez  ×3     lhuaraka   ×1     dmendez     ×1
calvarador  ×2     lpadilla   ×1     ylastra     ×1
fgamboa     ×1     m.salinas  ×1     rfernandez  ×1
```

Son 180 puntos que hoy siguen inflando el ranking. Mismo remedio que el caso 1:
el backfill mapea `Cancelado / Rechazado → reservation.fallen`.

---

## Por qué esto bloquea el cambio de fuente

ORED es autoritativo sobre `estado` —Atlas se alimenta de ORED, así que solo puede
estar desactualizado, nunca más correcto— y desde la migración 128 ya expone el
campo. Eso vuelve a ORED la fuente correcta para el ranking.

Pero cambiar hoy no elimina el error, solo lo cambia de forma: se corrigen las 12
mal contadas y se pierden las 33 que ORED no entrega. Con premiación cerca, la
decisión fue **cerrar primero el hueco**; cuando ambas fuentes coincidan, el
cambio de fuente deja de mover el ranking y se vuelve trivial.

La especificación del cambio está lista y en pausa: `useRankingPublico.js` a ORED,
`uf_ya_normalizada` en `mapReservaPublica`, `VITE_DATA_SOURCE=ored` en el interno.

## Nota aparte: una mina en el cálculo de UF

Independiente de todo lo anterior. `mapReserva.js:206` deja
`uf_ya_normalizada: false` para las filas de ORED, así que sus UF pasan por
`ufNormalizadoPlanilla()`, que toma los primeros 4 dígitos del valor.

Hoy no rompe nada —no hay reservas de 10.000 UF o más en la ventana, y el delta
total es de −149 UF sobre 1,15 M—, pero **la primera reserva de 10.000+ UF va a
perder el 90% de su valor sin avisar**. Las UF de ORED ya vienen limpias. Conviene
arreglarlo aunque el cambio de fuente no se haga.
