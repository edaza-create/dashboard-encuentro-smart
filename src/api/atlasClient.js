/**
 * Cliente del proxy de reservas de Atlas Engine.
 *
 * IMPORTANTE: este cliente NO conoce la credencial de Atlas y no debe conocerla
 * nunca. La clave da acceso a datos personales de clientes (nombre, correo,
 * telefono, RUT) y vive como secreto de la Edge Function `reservas-atlas`.
 * Cualquier variable expuesta al bundle (VITE_* / SUPABASE_*) es publica.
 *
 * Edge Function: supabase/functions/reservas-atlas/index.ts
 */

/**
 * @typedef {Object} ReservaAtlas
 * @property {string} reserva_id
 * @property {string} estado - Pendiente | Cancelado | Terminado | Toma Unidad
 * @property {string} event_kind - created | fallen | sold
 * @property {boolean} revertida - true si la reserva se cayo (event_kind fallen)
 * @property {boolean} vigente - inverso de revertida
 * @property {number|null} monto_uf - UF de la propiedad (equivale al monto_uf de ored)
 * @property {number|null} uf_reserva - abono de reserva segun Atlas; solo auditoria
 * @property {string|null} proyecto
 * @property {string|null} inmobiliaria
 * @property {string|null} comuna
 * @property {string|null} tipologia
 * @property {string|null} fecha - YYYY-MM-DD
 * @property {string|null} ocurrido_en - ISO 8601
 * @property {string|null} asesor_email
 * @property {string|null} asesor_nombre
 */

/**
 * @typedef {Object} AtlasResponse
 * @property {string} updated_at
 * @property {{ desde: string|null, hasta: string|null }} periodo
 * @property {'atlas-engine'} origen
 * @property {{ total_atlas: number, devueltas: number, caidas: number, vigentes: number }} conteo
 * @property {ReservaAtlas[]} reservas
 */

const FUNCTION_NAME = 'reservas-atlas'

function getFunctionsBaseUrl() {
  const explicit = import.meta.env.VITE_ATLAS_PROXY_URL
  if (explicit) return String(explicit).replace(/\/$/, '')

  const supabaseUrl =
    import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
  if (!supabaseUrl) return null
  return `${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`
}

/** true si hay como llamar al proxy (Supabase configurado o URL explicita). */
export function atlasProxyConfigured() {
  return Boolean(getFunctionsBaseUrl())
}

/** Convierte ISO 8601 o YYYY-MM-DD al YYYY-MM-DD que espera Atlas. */
function toFechaAtlas(valor) {
  if (!valor) return null
  const s = String(valor).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Trae las reservas del periodo desde Atlas, a traves del proxy.
 *
 * @param {Object} [options]
 * @param {string} [options.desde] - YYYY-MM-DD o ISO 8601
 * @param {string} [options.hasta] - YYYY-MM-DD o ISO 8601
 * @param {boolean} [options.soloVigentes] - si true, el proxy excluye las caidas
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<AtlasResponse>}
 */
export async function fetchReservasAtlas(options = {}) {
  const base = getFunctionsBaseUrl()
  if (!base) {
    throw new Error(
      'Proxy de Atlas no configurado: falta SUPABASE_URL o VITE_ATLAS_PROXY_URL'
    )
  }

  const params = new URLSearchParams()
  const desde = toFechaAtlas(options.desde ?? import.meta.env.VITE_CYBER_FECHA_DESDE)
  const hasta = toFechaAtlas(options.hasta ?? import.meta.env.VITE_CYBER_FECHA_HASTA)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  if (options.soloVigentes) params.set('solo_vigentes', 'true')

  const anonKey =
    import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  const res = await fetch(`${base}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      // El anon key es publico por diseno; la Edge Function corre con verify_jwt=false.
      ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
    },
    signal: options.signal,
  })

  if (!res.ok) {
    let detalle = ''
    try {
      const body = await res.json()
      detalle = body?.error ? `: ${body.error}` : ''
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(`Atlas proxy ${res.status}${detalle}`)
  }

  const body = await res.json()
  if (!Array.isArray(body?.reservas)) {
    throw new Error('Atlas proxy: shape invalido (reservas no es array)')
  }
  return body
}
