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
2. Valida además que el correo esté en **`ADMIN_EMAILS`**.
3. Recién entonces consulta a ORED con la key, que vive como secreto del servidor.
4. Responde con `Cache-Control: no-store` — la respuesta lleva PII.

Un usuario sin sesión recibe `401`; uno autenticado pero no administrador, `403`.
En ambos casos el dashboard cae al endpoint público y muestra "Sin datos de cliente".

> ⚠️ **No cambiar `verify_jwt` a `false`** en `supabase/config.toml`. Dejaría RUTs y
> teléfonos accesibles sin autenticación.

---

## Requisitos previos

| Requisito | Cómo obtenerlo |
| --- | --- |
| `API_KEY` del endpoint privado de ORED | La entrega el equipo de ORED por canal seguro, aparte del documento de handoff |
| Proyecto de Supabase configurado | `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `.env.local` |
| Lista de administradores | Los correos que podrán ver datos de cliente |

Sin Supabase configurado esto no funciona: no hay sesión que validar.

---

## 1. Cargar los secretos

```bash
supabase secrets set ORED_API_KEY='<api-key-de-ored>'
```

```bash
supabase secrets set ADMIN_EMAILS='uno@capitalinteligente.cl,dos@capitalinteligente.cl'
```

O desde el panel: **Edge Functions → Secrets → New secret**.

Ninguna de las dos va en el repo ni en `.env.local`: todo lo que lleve prefijo
`VITE_` o `SUPABASE_` termina en el bundle público.

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

`VITE_ADMIN_EMAILS` controla quién puede iniciar sesión en el dashboard.
`ADMIN_EMAILS` (el secreto) controla quién ve datos de cliente. Conviene que
coincidan, pero son listas independientes a propósito: se puede dar acceso al
dashboard sin dar acceso a la PII.

Reinicia el dev server: Vite solo lee el `.env` al arrancar.

## 4. Probar

Sin sesión debe responder `401`:

```bash
curl -i "https://<PROJECT>.supabase.co/functions/v1/reservas-privado?desde=2026-05-15T00:00:00-04:00&hasta=2026-07-15T23:59:59-04:00"
```

En el dashboard: inicia sesión con un correo de la lista y entra a **Reservas**.
La columna Cliente debe pasar de "Sin datos de cliente" a mostrar nombre y RUT, y
el modal debe traer correo y teléfono.

---

## Comportamiento esperado

| Situación | Resultado |
| --- | --- |
| Sin Supabase configurado | Endpoint público. "Sin datos de cliente" |
| Con sesión, correo no administrador | `403` → público. "Sin datos de cliente" |
| Con sesión, correo administrador | Datos de cliente visibles |
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
