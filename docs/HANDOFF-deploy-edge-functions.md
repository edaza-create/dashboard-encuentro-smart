# Handoff para Elkis — desplegar Edge Functions

> **TL;DR:** hay que correr dos `supabase functions deploy`. El código ya está en
> `main`. El push a GitHub despliega el frontend por Netlify, pero **no** las
> Edge Functions de Supabase: esas van aparte.
>
> Lo urgente es la primera: hoy el ranking tiene **885 puntos de más**.

---

## Contexto en una línea

El dashboard toma las reservas de Atlas Engine a través de una Edge Function que
guarda la credencial del lado del servidor. Se corrigió un bug de conteo, pero la
corrección vive en esa función y necesita desplegarse a mano.

---

## 1. `reservas-atlas` — URGENTE, corrige el puntaje

### El bug

**Atlas emite una fila por _evento_, no por reserva.** Una reserva que se creó y
después se cayó aparece **dos veces**, compartiendo `brekto_id`:

| `event_kind` | `estado` |
| --- | --- |
| `created` | Pendiente |
| `fallen` | Cancelado |

El dashboard filtraba las filas `fallen`, pero dejaba viva la fila `created` de
esa misma reserva — que seguía sumando 15 puntos.

### El impacto, medido en la ventana Cyber (15 may – 15 jul 2026)

```
475 filas de evento  →  416 reservas reales (brekto_id únicos)
 59 reservas con doble fila created + fallen
 59 reservas caídas que igual puntuaban  →  885 puntos fantasma
```

Caso concreto, **Marco Espinoza** (`marcko@capitalinteligente.cl`): 8 filas que
son 4 reservas, las 4 caídas. El ranking le cuenta 4 reservas y 60 puntos;
debería tener 0.

| Asesor | Cuenta hoy | Debería |
| --- | --- | --- |
| Marcko Espinoza | 4 | **0** |
| Marianella Iriarte | 6 | **0** |
| Nicole Fuentes | 5 | **0** |
| Mariana Samarotto | 9 | **3** |

> Dato que cierra el círculo: deduplicado, Atlas entrega **416 reservas** — el
> mismo número que el endpoint público de ORED. La diferencia 475 vs 416 nunca
> fue de criterio entre fuentes, era esta duplicación por eventos.

### La corrección

La función ahora agrupa por `brekto_id` y aplica la regla **una caída es
terminal**: si cualquiera de los eventos de la reserva dice que se cayó, la
reserva no puntúa. Además incluye `brekto_id` en la respuesta.

### Comando

```bash
supabase functions deploy reservas-atlas
```

No hay que tocar secretos: `ATLAS_API_KEY` ya está cargado y funcionando.

### Verificación

```bash
curl -s "https://upygbobjarduunbwzeva.supabase.co/functions/v1/reservas-atlas?desde=2026-05-15&hasta=2026-07-15" | head -c 300
```

El bloque `conteo` debe cambiar así:

| | Antes (hoy) | Después |
| --- | --- | --- |
| | `total_atlas: 475` | `filas_atlas: 475` |
| | `devueltas: 475` | `reservas: 416` |
| | `vigentes: 404` | `vigentes: 345` |

Y cada reserva debe traer el campo `brekto_id`.

En el dashboard: pestaña **Competencia Capital Open Individual**, buscar
"Marcko" → debe quedar en **0 reservas, 0 pts**.

---

## 2. `reservas-privado` — datos de cliente en la pestaña Reservas

### Qué habilita

Nombre, RUT, correo y teléfono del cliente en la tabla de reservas y en el modal
de detalle. Hoy la columna muestra "Sin datos de cliente".

### Por qué necesita una función

Las fuentes que entregan datos de cliente exigen credencial y **no tienen CORS**:
son máquina-a-máquina. Llamarlas desde el navegador expondría la key en las
DevTools. Además la respuesta lleva PII, así que la función exige **sesión de
Supabase válida** (`verify_jwt = true`) y responde con `Cache-Control: no-store`.

Hoy responde `404`: nunca se ha desplegado.

### Comando

```bash
supabase functions deploy reservas-privado
```

Tampoco requiere secretos nuevos: usa el mismo `ATLAS_API_KEY`.

Si más adelante ORED entrega la key de su endpoint privado, basta con cargarla y
la función cambia de fuente sola, sin redesplegar:

```bash
supabase secrets set ORED_API_KEY='<key-de-ored>'
```

### Verificación

```bash
curl -i "https://upygbobjarduunbwzeva.supabase.co/functions/v1/reservas-privado?desde=2026-05-15T00:00:00-04:00&hasta=2026-07-15T23:59:59-04:00"
```

Debe pasar de **404** a **401** (`Se requiere sesion iniciada`). El 401 es la
señal de éxito: la función existe y está protegida.

En el dashboard: iniciar sesión y entrar a **Reservas** → la columna Cliente debe
mostrar nombre y RUT.

> ⚠️ **No cambiar `verify_jwt` a `false`** en `supabase/config.toml`. Dejaría
> RUTs y teléfonos de ~1.900 clientes accesibles sin autenticación.

---

## 3. Pendiente de configuración: `VITE_ADMIN_EMAILS`

Los datos de cliente se muestran a **cualquier cuenta con sesión iniciada** (fue
una decisión explícita). Eso convierte a `VITE_ADMIN_EMAILS` en el control de
acceso real.

El `LoginGate` solo restringe correos si esa lista tiene contenido, y el alta por
OTP usa `shouldCreateUser: true`. **Si la lista queda vacía, cualquier correo
puede registrarse, entrar y ver datos personales de clientes.**

Hay que definirla en las variables de entorno de Netlify:

```
VITE_ADMIN_EMAILS=correo1@capitalinteligente.cl,correo2@capitalinteligente.cl
```

Es build-time: requiere redesplegar el sitio para que tome efecto.

---

## 4. Sugerencia: automatizar estos deploys

Ya van tres ocasiones en que un cambio queda a medias porque la Edge Function no
se desplegó. Un GitHub Action lo resuelve:

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions
on:
  push:
    branches: [main]
    paths: ['supabase/functions/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy --project-ref upygbobjarduunbwzeva
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Requiere generar un access token en Supabase (**Account → Access Tokens**) y
guardarlo como secret del repo con el nombre `SUPABASE_ACCESS_TOKEN`.

Con eso, funciones y frontend salen juntos en cada push.

---

## Checklist

- [ ] `supabase functions deploy reservas-atlas`
- [ ] Verificar que `conteo.reservas` sea 416 y que aparezca `brekto_id`
- [ ] Confirmar en el dashboard que Marcko Espinoza queda en 0 pts
- [ ] `supabase functions deploy reservas-privado`
- [ ] Verificar que responda 401 en vez de 404
- [ ] Definir `VITE_ADMIN_EMAILS` en Netlify y redesplegar
- [ ] (Opcional) Configurar el GitHub Action

---

## Referencias

| Tema | Archivo |
| --- | --- |
| Proxy de Atlas | `docs/DEPLOY-reservas-atlas.md` |
| Datos de cliente | `docs/DEPLOY-reservas-privado.md` |
| API pública de ORED | `docs/API-ranking-ored.md` |
| Lógica de deduplicación | `src/utils/dedupeReservas.js` + su archivo de tests |
| Regla de reservas caídas | `src/utils/reservaVigente.js` |

Los tests del repo (`pnpm test`, 37 casos) cubren ambas reglas, incluido el caso
de Marco Espinoza reproducido tal cual.
