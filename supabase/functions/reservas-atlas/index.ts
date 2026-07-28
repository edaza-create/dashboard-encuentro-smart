/**
 * GET /functions/v1/reservas-atlas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Proxy de solo lectura hacia la API de Reservas de Atlas Engine.
 *
 * Razon de existir: la credencial de Atlas da acceso a datos personales de
 * clientes (nombre, correo, telefono, RUT). El dashboard es una SPA sin
 * backend, asi que cualquier variable VITE_*/SUPABASE_* termina incrustada en
 * el bundle publico. Esta funcion mantiene la clave del lado del servidor y
 * devuelve unicamente los campos que el ranking necesita — los datos de
 * cliente NUNCA salen de aqui.
 *
 * Secreto requerido (Supabase → Edge Functions → Secrets):
 *   ATLAS_API_KEY
 *
 * Ver docs/DEPLOY-reservas-atlas.md
 */

const ATLAS_BASE = 'https://api.atlasengine.cl/reservations'
const PAGE_SIZE = 200
const MAX_PAGES = 50 // tope defensivo: 10.000 filas
const CACHE_TTL_MS = 60_000

/** Campos que se descartan por contener o permitir identificar datos personales. */
const CAMPOS_PROHIBIDOS = [
  'nombre_cliente',
  'cliente_email',
  'cliente_telefono',
  'cliente_rut',
  'lead_id',
  'sf_advisor_user_id',
  'sf_lead_owner_id',
] as const

type AtlasRow = Record<string, unknown>

type ReservaPublica = {
  reserva_id: string
  brekto_id: string | null
  estado: string
  event_kind: string
  revertida: boolean
  vigente: boolean
  monto_uf: number | null
  uf_reserva: number | null
  proyecto: string | null
  inmobiliaria: string | null
  comuna: string | null
  tipologia: string | null
  fecha: string | null
  ocurrido_en: string | null
  asesor_email: string | null
  asesor_nombre: string | null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  })
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Normaliza una fila de Atlas al shape publico.
 *
 * Sobre el monto UF: la doc de Atlas rotula `uf_valor_reserva` como "valor de
 * la reserva en UF", pero su magnitud (~40.000 promedio) no corresponde a UF de
 * una propiedad. El campo que calza con la cartera historica del dashboard
 * (~3.500 UF promedio) es `uf_valor_propiedad`, y es el que se expone como
 * `monto_uf`. `uf_valor_reserva` se pasa aparte por si se necesita auditar.
 */
function toPublica(row: AtlasRow): ReservaPublica | null {
  const id = str(row.id)
  if (!id) return null
  const eventKind = str(row.event_kind) ?? ''
  const revertida = eventKind === 'fallen'
  return {
    reserva_id: id,
    brekto_id: str(row.brekto_id),
    estado: str(row.estado) ?? '',
    event_kind: eventKind,
    revertida,
    vigente: !revertida,
    monto_uf: num(row.uf_valor_propiedad),
    uf_reserva: num(row.uf_valor_reserva),
    proyecto: str(row.proyecto),
    inmobiliaria: str(row.inmobiliaria),
    comuna: str(row.comuna),
    tipologia: str(row.tipologia),
    fecha: str(row.fecha_reserva),
    ocurrido_en: str(row.fecha_evento),
    asesor_email: str(row.asesor_email)?.toLowerCase() ?? null,
    asesor_nombre: str(row.asesor_nombre),
  }
}

/**
 * Atlas es event-based: emite UNA FILA POR EVENTO, no por reserva. Una reserva
 * que se creo y despues se cayo aparece dos veces — como `created` y como
 * `fallen`— y ambas comparten `brekto_id`.
 *
 * Sin deduplicar, filtrar solo las filas `fallen` deja viva la fila `created` de
 * esa misma reserva, que sigue sumando puntos. En la ventana Cyber eso eran 59
 * reservas caidas puntuando igual (885 puntos de mas).
 *
 * Regla: `fallen` es terminal. Si cualquier evento de la reserva dice que se
 * cayo, la reserva esta caida sin importar que otros eventos tenga. Entre los
 * demas gana el mas reciente por `ocurrido_en`.
 */
function dedupePorReserva(rows: ReservaPublica[]): ReservaPublica[] {
  const porReserva = new Map<string, ReservaPublica>()

  for (const row of rows) {
    // brekto_id identifica la reserva; reserva_id identifica solo esta fila.
    const clave = row.brekto_id ?? row.reserva_id
    const previa = porReserva.get(clave)

    if (!previa) {
      porReserva.set(clave, row)
      continue
    }
    if (previa.revertida) continue // ya es terminal
    if (row.revertida) {
      porReserva.set(clave, row)
      continue
    }
    const tPrevia = Date.parse(previa.ocurrido_en ?? '') || 0
    const tRow = Date.parse(row.ocurrido_en ?? '') || 0
    if (tRow > tPrevia) porReserva.set(clave, row)
  }

  return [...porReserva.values()]
}

/** Cinturon de seguridad: aborta si algun campo personal se colara al shape. */
function assertSinDatosPersonales(rows: ReservaPublica[]) {
  if (!rows.length) return
  const claves = new Set(Object.keys(rows[0]))
  for (const prohibido of CAMPOS_PROHIBIDOS) {
    if (claves.has(prohibido)) {
      throw new Error(`Campo personal "${prohibido}" presente en la respuesta`)
    }
  }
}

async function fetchPagina(apiKey: string, params: URLSearchParams, offset: number) {
  const q = new URLSearchParams(params)
  q.set('limit', String(PAGE_SIZE))
  q.set('offset', String(offset))

  const res = await fetch(`${ATLAS_BASE}?${q.toString()}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  })

  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    throw Object.assign(new Error(`Atlas ${res.status}: ${detalle.slice(0, 200)}`), {
      status: res.status,
    })
  }
  return (await res.json()) as { total?: number; items?: AtlasRow[] }
}

async function fetchTodas(apiKey: string, params: URLSearchParams) {
  const items: AtlasRow[] = []
  let offset = 0
  let total = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPagina(apiKey, params, offset)
    total = data.total ?? 0
    items.push(...(data.items ?? []))
    offset += PAGE_SIZE
    if (offset >= total || !data.items?.length) break
  }

  return { items, total }
}

/** Cache en memoria del worker: Atlas tarda ~1 s por pagina. */
const cache = new Map<string, { at: number; body: unknown }>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return json(405, { error: 'Metodo no permitido' })

  const apiKey = Deno.env.get('ATLAS_API_KEY')
  if (!apiKey) {
    return json(500, { error: 'ATLAS_API_KEY no configurado en los secretos de la funcion' })
  }

  const url = new URL(req.url)
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  const estado = url.searchParams.get('estado')
  const soloVigentes = url.searchParams.get('solo_vigentes') === 'true'

  const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
  if (desde && !FECHA_RE.test(desde)) return json(422, { error: 'desde debe ser YYYY-MM-DD' })
  if (hasta && !FECHA_RE.test(hasta)) return json(422, { error: 'hasta debe ser YYYY-MM-DD' })

  const params = new URLSearchParams()
  if (desde) params.set('date_from', desde)
  if (hasta) params.set('date_to', hasta)
  if (estado) params.set('estado', estado)

  const cacheKey = `${params.toString()}|${soloVigentes}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json(200, hit.body, { 'X-Cache': 'HIT' })
  }

  try {
    const { items, total } = await fetchTodas(apiKey, params)

    const filas = items.map(toPublica).filter((r): r is ReservaPublica => r !== null)
    let reservas = dedupePorReserva(filas)
    assertSinDatosPersonales(reservas)

    const caidas = reservas.filter((r) => r.revertida).length
    const vigentes = reservas.length - caidas
    if (soloVigentes) reservas = reservas.filter((r) => r.vigente)

    const body = {
      updated_at: new Date().toISOString(),
      periodo: { desde, hasta },
      origen: 'atlas-engine',
      conteo: {
        // `filas_atlas` son eventos; `reservas` es el conteo real tras deduplicar.
        filas_atlas: total,
        reservas: filas.length === 0 ? 0 : caidas + vigentes,
        devueltas: reservas.length,
        caidas,
        vigentes,
      },
      reservas,
    }

    cache.set(cacheKey, { at: Date.now(), body })
    return json(200, body, { 'X-Cache': 'MISS' })
  } catch (err) {
    const status = (err as { status?: number }).status
    const msg = err instanceof Error ? err.message : String(err)
    // Nunca propagar el detalle de un 401/403: podria filtrar informacion de la credencial.
    if (status === 401 || status === 403) {
      return json(502, { error: 'Atlas rechazo la credencial del proxy' })
    }
    return json(502, { error: `Fallo consultando Atlas: ${msg}` })
  }
})
