# Deploy — datos de cliente en la pestaña Reservas

Cómo activar el nombre, RUT, correo y teléfono del cliente en la tabla de reservas.

---

## Qué se necesita y por qué

Los datos de contacto solo existen en el **endpoint privado de ORED**
(`GET /api/encuentro-smart/ranking-privado`). El público no los trae.

Ese endpoint **no se puede llamar desde el navegador**. Del handoff de ORED:

> "No tiene CORS ni responde `OPTIONS`, a propósito. Si lo llaman desde un frontend,
> la key queda expuesta a cualquiera que abra las DevTools."

Por eso la llamada pasa por la Edge Function `reservas-privado`, que:

1. Exige **sesión de Supabase válida** (`verify_jwt = true`).
2. Consulta a ORED con la key, que vive como secreto del servidor.
3. Responde con `Cache-Control: no-store` — la respuesta lleva PII.

Un usuario sin sesión recibe `401` y el dashboard cae al endpoint público,
mostrando "Sin datos de cliente". Cualquier cuenta que logre iniciar sesión ve los
datos.

> ⚠️ **No cambiar `verify_jwt` a `false`** en `supabase/config.toml`. Dejaría RUTs y
> teléfonos accesibles sin autenticación.

### Quién puede iniciar sesión — configurar esto es obligatorio

Como el acceso a la PII depende solo de tener sesión, **quién puede crearse una
sesión pasa a ser el control de seguridad real**.

Eso lo define `VITE_ADMIN_EMAILS` en el `LoginGate`. Si esa lista queda **vacía**,
el alta por OTP usa `shouldCreateUser: true`: cualquier correo del mundo podría
registrarse, entrar al dashboard y ver RUTs y teléfonos de clientes.

**Define siempre `VITE_ADMIN_EMAILS`** con los correos del equipo antes de activar
esta función.

Si además quieres que solo un subconjunto de quienes entran al dashboard vea los
datos de cliente, define el secreto opcional `ADMIN_EMAILS` en la Edge Function:
cuando está presente, restringe; cuando no, basta con la sesión.

---

## Requisitos previos

| Requisito | Cómo obtenerlo |
| --- | --- |
| Credencial de una fuente con datos de cliente | `ORED_API_KEY` (preferida) **o** `ATLAS_API_KEY` |
| Proyecto de Supabase configurado | `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `.env.local` |
| `VITE_ADMIN_EMAILS` con el equipo | Correos que podrán iniciar sesión — ver la advertencia de arriba |

Sin Supabase configurado esto no funciona: no hay sesión que validar.

### Qué fuente usa

La función prefiere **ORED** y cae a **Atlas** si la key de ORED no está definida:

| Secretos cargados | Fuente | `origen` en la respuesta |
| --- | --- | --- |
| `ORED_API_KEY` | ORED privado | `ored-privado` |
| Solo `ATLAS_API_KEY` | Atlas Engine | `atlas-privado` |
| Ninguno | — | `500` |

El cambio es automático: al cargar `ORED_API_KEY` la función pasa a ORED sin
necesidad de redesplegar.

> La key de ORED la entrega su equipo por canal seguro, aparte del documento de
> handoff. Mientras no llegue, Atlas cubre la funcionalidad.

**Ojo con los números si usas Atlas:** filtra por fecha de negocio y reporta 475
reservas en la ventana Cyber, donde ORED reporta 416 (filtra por `ocurrido_en`).
La tabla podría mostrar reservas que no aparecen en el conteo de competencia.

---

## 1. Cargar los secretos

Con la key de ORED, si ya la tienes:

```bash
supabase secrets set ORED_API_KEY='<api-key-de-ored>'
```

O con Atlas mientras tanto:

```bash
supabase secrets set ATLAS_API_KEY='<api-key-de-atlas>'
```

También desde el panel: **Edge Functions → Secrets → New secret**.

La key no va en el repo ni en `.env.local`: todo lo que lleve prefijo `VITE_` o
`SUPABASE_` termina en el bundle público.

Opcional, solo si quieres restringir más allá de tener sesión:

```bash
supabase secrets set ADMIN_EMAILS='uno@capitalinteligente.cl,dos@capitalinteligente.cl'
```

## 2. Desplegar

```bash
supabase functions deploy reservas-privado
```

## 3. Configurar el frontend

En `.env.local`:

```bash
SUPABASE_URL=https://<PROJECT>.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
VITE_ADMIN_EMAILS=uno@capitalinteligente.cl,dos@capitalinteligente.cl
```

`VITE_ADMIN_EMAILS` es el control de acceso efectivo: define quién puede iniciar
sesión y, por lo tanto, quién ve los datos de cliente. **No lo dejes vacío.**

Reinicia el dev server: Vite solo lee el `.env` al arrancar.

## 4. Probar

Sin sesión debe responder `401`:

```bash
curl -i "https://<PROJECT>.supabase.co/functions/v1/reservas-privado?desde=2026-05-15T00:00:00-04:00&hasta=2026-07-15T23:59:59-04:00"
```

En el dashboard: inicia sesión y entra a **Reservas**. La columna Cliente debe
pasar de "Sin datos de cliente" a mostrar nombre y RUT, y el modal debe traer
correo y teléfono.

---

## Comportamiento esperado

| Situación | Resultado |
| --- | --- |
| Sin Supabase configurado | Endpoint público. "Sin datos de cliente" |
| Sin sesión iniciada | `401` → público. "Sin datos de cliente" |
| Con sesión iniciada | Datos de cliente visibles |
| Con `ADMIN_EMAILS` definido y correo fuera de la lista | `403` → público |
| ORED rechaza la key | `502` → público, sin romper la vista |

El fallback es silencioso por diseño: la pestaña Reservas nunca queda vacía por un
problema de permisos o de credencial.

---

## Nota sobre el conteo

Este endpoint devuelve **exactamente las mismas reservas y montos** que el público
— así lo garantiza ORED, porque ambos leen de la misma vista base. Solo agrega los
4 campos de cliente.

El filtro de reservas caídas (`Cancelado` / `Rechazado`) se aplica igual, así que
activar esto **no cambia el ranking ni los puntos**. Ver `docs/API-ranking-ored.md`
sección 4.
