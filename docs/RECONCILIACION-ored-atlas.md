# Reconciliación ORED ↔ Atlas — ventana Cyber

**Estado:** parcialmente resuelto. Sigue bloqueando el cambio de fuente a ORED.
**Medido:** 2026-07-28, ventana 2026-05-15 → 2026-07-15 (por fecha de reserva).

## El problema en una línea

Dos sistemas que deberían coincidir difieren, y ninguno de los dos es
superconjunto del otro.

| Caso | Antes | Después del backfill | Qué significa |
| --- | --- | --- | --- |
| `ESTADO_DISCREPA` | 12 | **0** ✅ | ORED decía `Cancelado`, Atlas `Pendiente`/`created` |
| `FALTA_EN_ATLAS` | 34 | **32** | ORED las tiene; Atlas nunca las ingirió |
| `FALTA_EN_ORED` | 33 | **33** | Atlas las tiene; el endpoint público de ORED no las devuelve |

El 2026-07-28 se corrió `backfill_reservas_ored.py --estado Cancelado` sobre la
base de Atlas: 84 escrituras, 14 dentro de la ventana Cyber. Eliminó los 180
puntos fantasma y llevó a Atlas de 345 a **333 vigentes**.

## La trampa: coincidir en el total no es coincidir

Las dos fuentes ahora reportan **333 vigentes**, pero es por compensación: a Atlas
le faltan 32 vigentes y a ORED le faltan otros 32, distintos.

Al comparar asesor por asesor, **32 de 83 asesores tienen conteos diferentes**,
con una diferencia absoluta acumulada de **50 reservas (750 puntos)**:

```
colivero      ORED 15  Atlas 20   (+5)
vchirinos     ORED 23  Atlas 19   (-4)
drojo         ORED  9  Atlas  5   (-4)
fcortesa      ORED 18  Atlas 20   (+2)
```

`vchirinos` está en la parte alta de la tabla: un movimiento de 4 reservas son 60
puntos y puede cambiar el podio. **Mirar solo el total agregado oculta esto** — es
la razón por la que el cambio de fuente sigue bloqueado.

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

## Caso 1 — 32 reservas que Atlas no tiene

**Para el equipo de Atlas.** Reservas presentes en ORED y ausentes en Atlas
incluso con ventana ancha: nunca se ingirieron. Estados en ORED (las 2
`Cancelado` ya se recuperaron con el backfill):

```
Terminado 17 · Pendiente 8 · Procesando 6 · Toma Unidad 1
```

No son de un solo día ni de una sola inmobiliaria, así que no parece una caída
puntual del webhook.

**Las 6 `Procesando` no las cubre ninguna corrida del backfill**: ese estado no
está en `_ESTADO_TO_EVENT_TYPE`, así que se saltan siempre. Hay que decidir a qué
`event_type` mapean, o si deben quedar fuera a propósito.

Las 26 restantes se recuperarían con la corrida completa, pero eso **sube** los
vigentes de Atlas en vez de bajarlos, así que conviene coordinarlo antes de una
premiación:

```bash
python scripts/backfill_reservas_ored.py --dry-run     # primero, siempre
```

Nota operativa: el script necesita Python ≤3.12 (con 3.14 falla el build de
`pydantic-core`) y que la CLI de Supabase esté linkeada a ORED en
`~/Documents/ored`.

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

## Caso 3 — 12 reservas con estado contradictorio ✅ RESUELTO

Todas iban en la misma dirección: ORED `Cancelado`, Atlas `Pendiente`/`created`.
Atlas nunca había recibido el `reservation.fallen`.

```
brodriguez  ×3     lhuaraka   ×1     dmendez     ×1
calvarador  ×2     lpadilla   ×1     ylastra     ×1
fgamboa     ×1     m.salinas  ×1     rfernandez  ×1
```

Eran 180 puntos inflando el ranking. Resuelto el 2026-07-28 con
`backfill_reservas_ored.py --estado Cancelado`: 84 escrituras totales, de las
cuales 80 fueron el evento `fallen` faltante de reservas que Atlas ya tenía y 4
reservas nuevas. Verificado: `ESTADO_DISCREPA` quedó en 0.

---

## Por qué esto bloquea el cambio de fuente

ORED es autoritativo sobre `estado` —Atlas se alimenta de ORED, así que solo puede
estar desactualizado, nunca más correcto— y desde la migración 128 ya expone el
campo. Eso vuelve a ORED la fuente correcta para el ranking.

El backfill cerró la parte de Atlas que era corregible y ambas fuentes ya
coinciden en 333 vigentes. Pero **esa coincidencia es de total, no de
composición**: 32 asesores siguen con conteos distintos y 750 puntos separan una
lectura de la otra. Mientras eso siga así, elegir fuente sigue eligiendo podio.

Lo que falta es lo que no depende de nosotros: que ORED explique o entregue sus
33, y decidir qué hacer con las 32 que Atlas no tiene (26 recuperables por
backfill, 6 sin mapeo de estado).

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
