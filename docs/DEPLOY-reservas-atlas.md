# Deploy — proxy de reservas Atlas Engine

Pasos para poner en producción la Edge Function `reservas-atlas`, que es la fuente
principal de reservas del dashboard.

---

## Por qué existe este proxy

La credencial de Atlas Engine da acceso de lectura a **datos personales de ~1.939
clientes** (nombre, correo, teléfono y RUT). La documentación de Atlas es explícita:

> "Usala exclusivamente desde el backend. Nunca la incluyas en codigo de navegador,
> aplicaciones moviles ni repositorios."

Este dashboard es una SPA sin backend: por el `envPrefix` de `vite.config.js`, toda
variable `VITE_*` o `SUPABASE_*` **queda incrustada en el bundle público**. Y `/cyber`
es una página sin autenticación.

Poner la clave en el frontend expondría esos datos a cualquiera que abra las devtools.
El proxy resuelve esto: la clave vive como secreto del servidor y la función devuelve
**solo** los campos que el ranking necesita. Los datos de cliente nunca salen de Atlas.

La función incluye un cinturón de seguridad (`assertSinDatosPersonales`) que aborta la
respuesta si algún campo personal se colara al shape público.

---

## 1. Cargar el secreto

La credencial **no va en el repo ni en ningún `.env`**. Se carga como secreto de la
función:

```bash
supabase secrets set ATLAS_API_KEY='<credencial-de-atlas>'
```

O desde el panel: **Supabase → Edge Functions → Secrets → New secret**, con nombre
`ATLAS_API_KEY`.

Para verificar que quedó cargado (no muestra el valor):

```bash
supabase secrets list
```

## 2. Desplegar la función

```bash
supabase functions deploy reservas-atlas
```

`verify_jwt = false` ya está declarado en `supabase/config.toml`: la función es pública
porque la llama el navegador, pero no expone nada sensible.

## 3. Probar

```bash
curl "https://<PROJECT>.supabase.co/functions/v1/reservas-atlas?desde=2026-05-15&hasta=2026-07-15"
```

Respuesta esperada:

```json
{
  "updated_at": "2026-07-27T…",
  "periodo": { "desde": "2026-05-15", "hasta": "2026-07-15" },
  "origen": "atlas-engine",
  "conteo": { "total_atlas": 475, "devueltas": 475, "caidas": 71, "vigentes": 404 },
  "reservas": [ … ]
}
```

Comprobación rápida de que no se filtran datos personales:

```bash
curl -s "https://<PROJECT>.supabase.co/functions/v1/reservas-atlas?desde=2026-05-15&hasta=2026-07-15" | grep -c "cliente_rut"
```

Debe devolver `0`.

## 4. Frontend

No requiere configuración extra si `SUPABASE_URL` ya está definido: el cliente arma la
URL de la función sola. Para apuntar a otro host:

```bash
VITE_ATLAS_PROXY_URL=https://<PROJECT>.supabase.co/functions/v1/reservas-atlas
```

---

## Parámetros de la función

| Parámetro | Formato | Descripción |
| --- | --- | --- |
| `desde` | `YYYY-MM-DD` | Inicio del periodo, inclusive |
| `hasta` | `YYYY-MM-DD` | Fin del periodo, inclusive |
| `estado` | texto | Filtra por estado exacto de Atlas |
| `solo_vigentes` | `true` | Excluye las caídas ya en el servidor |

Un formato de fecha inválido devuelve `422`. La respuesta se cachea 60 s en memoria del
worker, porque Atlas tarda ~1 s por página de 200 filas.

---

## Qué cambia respecto de ored

| | ored | Atlas |
| --- | --- | --- |
| Estado de la reserva | ❌ no lo informa | ✅ `estado` + `event_kind` |
| Reservas caídas | invisibles, sumaban puntos | identificadas y excluidas |
| Comuna / tipología | parcial | ✅ campos propios |
| Fotos de asesores | ✅ | ❌ no las tiene |

Por eso **ored se sigue consultando solo para los avatares** del ranking público. Si
Atlas falla, el dashboard cae automáticamente a ored (con la limitación de que ahí las
caídas vuelven a ser invisibles).

### El campo UF: cuidado

Atlas documenta `uf_valor_reserva` como "valor de la reserva en UF", pero su magnitud
(~40.000 promedio) no corresponde a UF de una propiedad. El campo que calza con la
cartera histórica (~3.500 UF promedio, igual que ored) es **`uf_valor_propiedad`**, y es
el que el proxy expone como `monto_uf`.

`uf_valor_reserva` se expone aparte como `uf_reserva` solo para auditoría. **No usarlo
para la cartera**: inflaría los montos ~11×.

Además, las reservas de Atlas se marcan con `uf_ya_normalizada: true` para saltarse
`ufNormalizadoPlanilla()`, que existe para corregir valores malformados de la planilla y
dividiría por 10 cualquier propiedad de 10.000 UF o más.

---

## Impacto medido

Ventana Cyber (15 may – 15 jul 2026), verificado contra la API real:

```
475 reservas en el periodo
 71 caídas (14,9%)  ->  excluidas del conteo
404 vigentes

Competencia:  473 -> 402 reservas
Puntos fantasma eliminados: 1.065
31 asesores tenían al menos una reserva caída sumando puntos
```

---

## Rotación de la credencial

Cada consumidor tiene su propia clave y rotarla no afecta a otros integradores. La
rotación la ejecuta el equipo de Atlas Engine y demora unos minutos. Tras rotar, basta
con volver a cargar el secreto y **no** hace falta redesplegar la función:

```bash
supabase secrets set ATLAS_API_KEY='<nueva-credencial>'
```
