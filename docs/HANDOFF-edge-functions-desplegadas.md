# Respuesta a Valentín — Edge Functions desplegadas

**TL;DR:** las dos funciones están en producción y el ranking ya está corregido.
Haz `git pull` para traer un commit que necesitas: sin él, `supabase functions
deploy` te va a seguir fallando desde tu máquina.

Quedan 180 puntos fantasma que **no** se arreglan desde este repo — ver la
sección 4.

---

## 0. Lo que tienes que hacer tú

```bash
git pull origin main    # trae 09de171
```

Eso es todo para tener el código al día. No necesitas redesplegar nada: las
funciones y el frontend ya salieron.

---

## 1. Por qué no se reflejaban tus cambios

La corrección de deduplicación estaba bien escrita y commiteada en `main` desde
`d97c82a`. El problema era que **la función no compilaba**, así que nunca llegó
a producción.

El comentario de cabecera de `supabase/functions/reservas-atlas/index.ts` tenía
esta línea:

```
 * backend, asi que cualquier variable VITE_*/SUPABASE_* termina incrustada en
                                              ^^
```

Ese `*/` cierra el bloque de comentario antes de tiempo. A partir de ahí el
resto de la cabecera queda como código suelto y el bundler aborta:

```
Error: failed to create the graph
Caused by: The module's source code could not be parsed:
    Expected ';', '}' or <eof> at .../reservas-atlas/index.ts:8:66
```

La pista que lo confirma: la función que estaba viva en producción apuntaba a

```
entrypoint_path: file:///private/tmp/.../scratchpad/deploy-fn/supabase/functions/reservas-atlas/index.ts
```

o sea, se había desplegado desde una copia manual en un directorio temporal, no
desde el repo. Por eso el deploy "funcionó" esa vez y por eso ningún cambio
posterior del repo llegaba: el archivo real nunca compiló.

Corregido en `09de171` (una línea, `VITE_ o SUPABASE_`). Ahora `main` se
despliega directo.

---

## 2. Estado en producción

Ambas funciones desplegadas al proyecto `upygbobjarduunbwzeva`.

### `reservas-atlas` — v2

| Campo | Antes | Ahora |
| --- | --- | --- |
| `filas_atlas` | 475 (`total_atlas`) | 475 |
| `reservas` | — | **416** |
| `devueltas` | 475 | 416 |
| `caidas` | 71 | 71 |
| `vigentes` | 404 | **345** |

Cada reserva trae `brekto_id`. Los 416 coinciden exactamente con el endpoint
público de ORED, tal como esperabas.

Los cuatro casos de tu tabla, verificados contra la respuesta real aplicando la
regla de vigencia del frontend:

| Asesor | Contaba | Ahora |
| --- | --- | --- |
| Marcko Espinoza | 4 | **0** |
| Marianella Iriarte | 6 | **0** |
| Nicole Fuentes | 5 | **0** |
| Mariana Samarotto | 9 | **3** |

### `reservas-privado` — v1

Pasó de 404 a 401 con `verify_jwt=true`. La columna Cliente ya debería mostrar
nombre y RUT al iniciar sesión.

### Frontend

Netlify redesplegado desde `09de171`. `VITE_ADMIN_EMAILS` quedó horneada en el
bundle (verificado sobre el JS servido en producción).

---

## 3. Corrección a lo que decía tu handoff sobre `VITE_ADMIN_EMAILS`

Tu documento decía que definir `VITE_ADMIN_EMAILS` en Netlify resuelve el
control de acceso a los datos de cliente. **No lo resuelve**, y vale la pena que
quede claro porque son RUTs y teléfonos de ~1.900 personas.

`src/config/admins.js` lee esa variable con `import.meta.env`, o sea vive en el
bundle del cliente. El LoginGate es una reja de React. Con
`shouldCreateUser: true` en `AuthContext.jsx:50`, cualquiera puede:

1. pedir un OTP para su correo,
2. crear cuenta y obtener un JWT válido del proyecto,
3. llamar `reservas-privado` con `curl`, sin pasar nunca por el LoginGate.

El único control que corre del lado del servidor es el secreto `ADMIN_EMAILS`
de la Edge Function. Y ojo con esta línea:

```ts
if (admins.size > 0 && !admins.has(email)) { ... }
```

Con el secreto vacío, `admins.size` es 0 y **el chequeo se salta entero**. Estaba
vacío. Quedó cargado con los cinco correos de la lista:

```
edaza, vpedrerop, djerez, amarisio, cgonzalez  (@capitalinteligente.cl)
```

Probado: la anon key sola —que está expuesta en el bundle público y sí pasa el
gate `verify_jwt`— devuelve 401.

Para agregar o quitar a alguien, el que manda es el secreto, no Netlify:

```bash
supabase secrets set ADMIN_EMAILS='a@...,b@...' --project-ref upygbobjarduunbwzeva
```

Toma efecto de inmediato, sin redeploy. Conviene mantener `VITE_ADMIN_EMAILS`
sincronizada igual, pero solo para que el login se vea coherente.

---

## 4. Quedan 180 puntos fantasma, y no son de este repo

Crucé las 416 reservas de Atlas contra las 416 de ORED. Los IDs son comparables:
`ORED.reserva_id` == `Atlas.brekto_id` (382 en común; los 34 de cada lado que no
cruzan son diferencia de ventana, ORED filtra por `ocurrido_en` y Atlas por
`fecha_reserva`).

De esas 382, **12 tienen vigencia contradictoria**, todas en el mismo sentido:

```
ORED = Cancelado   →   Atlas = Pendiente / event_kind: created     ×12
```

Es decir, Atlas nunca recibió el evento `reservation.fallen` de esas 12 reservas.
Como el único marcador de caída que tiene Atlas es `event_kind`, siguen contando:
**12 × 15 = 180 pts** todavía inflados.

Desglose por asesor (reservas, no puntos):

```
brodriguez  ×3     lhuaraka   ×1     dmendez     ×1
calvarador  ×2     lpadilla   ×1     ylastra     ×1
fgamboa     ×1     m.salinas  ×1     rfernandez  ×1
```

Esto es un hueco de ingesta en Atlas, no del dashboard: ningún cambio acá lo
arregla. El remedio candidato está en `~/Documents/atlasengine`:

```bash
python scripts/backfill_reservas_ored.py --estado Cancelado --dry-run
```

Ese script mapea `Cancelado / Rechazado → reservation.fallen` y es idempotente
por `(brekto_id, estado)`, así que reprocesarlo es seguro. **No lo corrí**:
escribe en la base de producción de Atlas y necesita el link a ored más las
credenciales de Salesforce. Queda a tu criterio si lo abordamos.

---

## 5. Un dato que quizás explique otra confusión

`VITE_RANKING_SUSPENSO` está en `true` en Netlify (viene de `netlify.toml`). El
ranking público `/cyber` está ocultando **todas** las cifras y el orden real
—reordena alfabético, sin posiciones ni medallas—. Si estabas mirando `/cyber`
para validar los cambios, no ibas a ver números pasara lo que pasara.

Para revelar: cambiar a `false` y redesplegar.

---

## 6. Sobre tu propuesta del GitHub Action

Tenías razón, y este episodio la refuerza: el problema no fue solo olvidar un
deploy, fue que el deploy manual desde una copia temporal **enmascaró un archivo
que no compilaba** durante varios commits. Un Action que despliega desde el repo
habría fallado ruidosamente el primer día.

El YAML de tu handoff sirve tal cual. Solo hay que crear el access token en
Supabase (Account → Access Tokens) y guardarlo como secret `SUPABASE_ACCESS_TOKEN`
del repo.

---

## Checklist

- [x] `supabase functions deploy reservas-atlas` → v2
- [x] `conteo.reservas` = 416 y `brekto_id` presente en cada fila
- [x] Marcko Espinoza en 0 reservas / 0 pts (y los otros tres casos)
- [x] `supabase functions deploy reservas-privado` → 401 en vez de 404
- [x] `VITE_ADMIN_EMAILS` en Netlify + redeploy
- [x] `ADMIN_EMAILS` como secreto de la función (el control real)
- [ ] **Tú:** `git pull origin main`
- [ ] Backfill de las 12 reservas sin evento `fallen` (repo atlasengine)
- [ ] GitHub Action para los deploys

## Referencias

| Tema | Dónde |
| --- | --- |
| Tu handoff original | `docs/HANDOFF-deploy-edge-functions.md` |
| Proxy de Atlas | `docs/DEPLOY-reservas-atlas.md` |
| Datos de cliente | `docs/DEPLOY-reservas-privado.md` |
| API pública de ORED | `docs/API-ranking-ored.md` |
| Llave única de Atlas | `atlasengine/apps/api/app/db/repositories/reservation_repo.py` |
| Backfill | `atlasengine/scripts/backfill_reservas_ored.py` |
