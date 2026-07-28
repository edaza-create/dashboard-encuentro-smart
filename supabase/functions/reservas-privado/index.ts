/**
 * GET /functions/v1/reservas-privado?desde=<ISO>&hasta=<ISO>
 *
 * Proxy autenticado de reservas CON datos de contacto del cliente
 * (nombre, correo, RUT, telefono).
 *
 * Por que existe:
 *  - Las fuentes que entregan datos de cliente exigen credencial y no tienen
 *    CORS: son maquina-a-maquina. Llamarlas desde el navegador expondria la key
 *    en las DevTools.
 *  - La respuesta lleva PII, asi que este proxy NO puede ser publico: exige
 *    sesion de Supabase valida (`verify_jwt = true`).
 *
 * Diferencia con `reservas-atlas`: aquella es publica y descarta los datos de
 * cliente; esta los entrega a cualquier cuenta con sesion iniciada.
 *
 * Quien puede iniciar sesion lo controla `VITE_ADMIN_EMAILS` en el LoginGate del
 * dashboard. IMPORTANTE: si esa lista queda vacia, el alta por OTP usa
 * `shouldCreateUser: true` y cualquier correo podria registrarse y ver la PII.
 *
 * Fuente de datos: usa ORED si su key esta configurada; si no, cae a Atlas.
 * Asi, al cargar ORED_API_KEY el cambio de fuente es automatico, sin desplegar.
 *
 * Secretos (Supabase → Edge Functions → Secrets):
 *   ORED_API_KEY    key del endpoint privado de ORED   (preferida)
 *   ATLAS_API_KEY   key de Atlas Engine                (alternativa)
 *   ADMIN_EMAILS    restriccion extra por correo       (opcional)
 *
 * Ver docs/DEPLOY-reservas-privado.md
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const ORED_BASE = 'https://ored.cl/api/encuentro-smart/ranking-privado'
const ATLAS_BASE = 'https://api.atlasengine.cl/reservations'
const ATLAS_PAGE = 200
const ATLAS_MAX_PAGES = 50

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // La respuesta lleva PII: no debe quedar en caches intermedias.
      'Cache-Control': 'no-store',
      ...CORS,
      ...extra,
    },
  })
}

function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
  )
}

/** Resuelve el correo del usuario a partir del JWT de la peticion. */
async function emailDeLaSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user?.email) return null
  return data.user.email.trim().toLowerCase()
}

// --- ORED -------------------------------------------------------------------

async function desdeOred(key: string, desde: string, hasta: string, limit: string | null) {
  const params = new URLSearchParams({ desde, hasta })
  if (limit) params.set('limit', limit)

  const res = await fetch(`${ORED_BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detalle = res.status === 401 ? 'credencial rechazada' : await res.text().catch(() => '')
    throw new Error(`ORED ${res.status}: ${String(detalle).slice(0, 200)}`)
  }
  const body = await res.json()
  return { reservas: body.reservas ?? [], total: body.total ?? 0, origen: 'ored-privado' }
}

// --- Atlas ------------------------------------------------------------------

/** Atlas filtra por fecha de negocio (YYYY-MM-DD), no por timestamp. */
function aFechaAtlas(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * Normaliza una fila de Atlas al mismo shape que devuelve ORED, para que el
 * dashboard use un solo mapper.
 *
 * `monto_uf` sale de `uf_valor_propiedad`: Atlas documenta `uf_valor_reserva`
 * como UF pero promedia ~40.000 (es el abono) e inflaria la cartera ~11x.
 */
function atlasAOredShape(r: Record<string, unknown>) {
  const ek = String(r.event_kind ?? '').trim()
  const s = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  const n = (v: unknown) => {
    if (v == null || v === '') return null
    const x = Number(v)
    return Number.isFinite(x) ? x : null
  }
  return {
    reserva_id: String(r.id ?? ''),
    ocurrido_en: s(r.fecha_evento),
    fecha: s(r.fecha_reserva),
    hora: null,
    proyecto: s(r.proyecto),
    inmobiliaria: s(r.inmobiliaria),
    comuna: s(r.comuna),
    tipologia: s(r.tipologia),
    unidad: null,
    monto_uf: n(r.uf_valor_propiedad),
    estado: s(r.estado) ?? '',
    revertida: ek === 'fallen',
    /** Atlas entrega UF limpias: el dashboard no debe normalizarlas. */
    uf_ya_normalizada: true,
    asesor_email: s(r.asesor_email)?.toLowerCase() ?? null,
    asesor_nombre: s(r.asesor_nombre),
    asesor_foto_url: null,
    asesor_foto_urls: null,
    // Los 4 campos que motivan este endpoint
    nombre_cliente: s(r.nombre_cliente),
    cliente_email: s(r.cliente_email),
    cliente_rut: s(r.cliente_rut),
    cliente_telefono: s(r.cliente_telefono),
  }
}

async function desdeAtlas(key: string, desde: string, hasta: string) {
  const base = new URLSearchParams({
    date_from: aFechaAtlas(desde),
    date_to: aFechaAtlas(hasta),
  })

  const items: Record<string, unknown>[] = []
  let offset = 0
  let total = 0

  for (let page = 0; page < ATLAS_MAX_PAGES; page++) {
    const q = new URLSearchParams(base)
    q.set('limit', String(ATLAS_PAGE))
    q.set('offset', String(offset))

    const res = await fetch(`${ATLAS_BASE}?${q.toString()}`, {
      headers: { 'X-API-Key': key, Accept: 'application/json' },
    })
    if (!res.ok) {
      const detalle = res.status === 401 ? 'credencial rechazada' : await res.text().catch(() => '')
      throw new Error(`Atlas ${res.status}: ${String(detalle).slice(0, 200)}`)
    }
    const data = await res.json()
    total = data.total ?? 0
    items.push(...(data.items ?? []))
    offset += ATLAS_PAGE
    if (offset >= total || !data.items?.length) break
  }

  return { reservas: items.map(atlasAOredShape), total, origen: 'atlas-privado' }
}

// --- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return json(405, { error: 'Metodo no permitido' })

  const oredKey = Deno.env.get('ORED_API_KEY')
  const atlasKey = Deno.env.get('ATLAS_API_KEY')
  if (!oredKey && !atlasKey) {
    return json(500, {
      error: 'Sin fuente configurada: define ORED_API_KEY o ATLAS_API_KEY en los secretos',
    })
  }

  // 1. Sesion valida: basta con estar autenticado en el dashboard.
  const email = await emailDeLaSesion(req)
  if (!email) return json(401, { error: 'Se requiere sesion iniciada' })

  // 2. Restriccion opcional por correo.
  const admins = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'))
  if (admins.size > 0 && !admins.has(email)) {
    return json(403, { error: 'Tu cuenta no tiene acceso a datos de cliente' })
  }

  // 3. Parametros
  const url = new URL(req.url)
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  if (!desde || !hasta) {
    return json(400, { error: 'Faltan los parametros desde y hasta (ISO 8601)' })
  }
  if (Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) {
    return json(400, { error: 'desde y hasta deben ser ISO 8601 con offset' })
  }
  if (Date.parse(desde) > Date.parse(hasta)) {
    return json(400, { error: 'desde debe ser menor o igual que hasta' })
  }

  // 4. ORED si esta disponible; si no, Atlas.
  try {
    const data = oredKey
      ? await desdeOred(oredKey, desde, hasta, url.searchParams.get('limit'))
      : await desdeAtlas(atlasKey!, desde, hasta)

    return json(200, {
      updated_at: new Date().toISOString(),
      periodo: { desde, hasta },
      origen: data.origen,
      total: data.total,
      solicitado_por: email,
      reservas: data.reservas,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json(502, { error: `Fallo consultando la fuente: ${msg}` })
  }
})
