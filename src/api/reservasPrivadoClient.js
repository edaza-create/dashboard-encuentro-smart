/**
 * Cliente del proxy autenticado de reservas con datos de cliente.
 *
 * Este cliente NO conoce la API key de ORED y no debe conocerla: vive como
 * secreto de la Edge Function `reservas-privado`. Aca solo viaja el JWT de la
 * sesion del usuario, que la funcion valida contra la lista de administradores.
 *
 * Edge Function: supabase/functions/reservas-privado/index.ts
 */
import { supabase, supabaseConfigured } from '../data/supabaseClient.js'

/**
 * @typedef {Object} ReservaPrivada
 * Mismos 13 campos del endpoint publico, mas los 4 de cliente:
 * @property {string|null} nombre_cliente
 * @property {string|null} cliente_email
 * @property {string|null} cliente_rut
 * @property {string|null} cliente_telefono
 */

const FUNCTION_NAME = 'reservas-privado'

function getFunctionUrl() {
  const explicit = import.meta.env.VITE_RESERVAS_PRIVADO_URL
  if (explicit) return String(explicit).replace(/\/$/, '')

  const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
  if (!supabaseUrl) return null
  return `${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`
}

/** true si hay Supabase configurado y URL de la funcion. */
export function reservasPrivadoConfigured() {
  return Boolean(supabaseConfigured && getFunctionUrl())
}

/**
 * Trae las reservas del periodo con datos de cliente.
 *
 * Requiere sesion iniciada y correo en la lista de administradores. Si no se
 * cumple, la funcion responde 401 o 403 y este cliente lanza el error para que
 * el consumidor caiga a la fuente publica.
 *
 * @param {Object} [options]
 * @param {string} [options.desde] - ISO 8601 con offset
 * @param {string} [options.hasta] - ISO 8601 con offset
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ updated_at: string, periodo: object, total: number, reservas: ReservaPrivada[] }>}
 */
export async function fetchReservasPrivado(options = {}) {
  const url = getFunctionUrl()
  if (!url) throw new Error('Proxy privado no configurado: falta SUPABASE_URL')
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion?.session?.access_token
  if (!token) throw new Error('Se requiere sesion iniciada')

  const desde = options.desde ?? import.meta.env.VITE_CYBER_DESDE
  const hasta = options.hasta ?? import.meta.env.VITE_CYBER_HASTA
  if (!desde || !hasta) {
    throw new Error('Faltan VITE_CYBER_DESDE / VITE_CYBER_HASTA')
  }

  const params = new URLSearchParams({ desde, hasta })
  if (options.limit) params.set('limit', String(options.limit))

  const res = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
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
    throw new Error(`Reservas privado ${res.status}${detalle}`)
  }

  const body = await res.json()
  if (!Array.isArray(body?.reservas)) {
    throw new Error('Reservas privado: shape invalido (reservas no es array)')
  }
  return body
}
