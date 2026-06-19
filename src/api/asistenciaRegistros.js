import { supabase, supabaseConfigured } from '../data/supabaseClient.js'
import { reunionCuentaParaPuntos } from '../utils/asistenciaFechaCorte.js'

/**
 * Fetch reunión pública (anon — para el formulario QR).
 * @param {string} reunionId
 */
export async function fetchReunionPublica(reunionId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('asistencia_reuniones_config')
    .select('id, nombre, tipo, qr_generated_at, closes_at, cerrada_manual, archivada')
    .eq('id', reunionId)
    .single()
  if (error) return null
  return data
}

/**
 * Deriva el estado de una reunión a partir de sus campos.
 * @param {{ qr_generated_at: string|null, closes_at: string|null, cerrada_manual: boolean, archivada: boolean }} r
 * @returns {'borrador'|'activa'|'cerrada'|'archivada'}
 */
export function deriveEstado(r) {
  if (r.archivada) return 'archivada'
  if (!r.qr_generated_at) return 'borrador'
  const closed = r.cerrada_manual || (r.closes_at && new Date(r.closes_at) <= new Date())
  return closed ? 'cerrada' : 'activa'
}

/**
 * Insert asistencia (anon — desde formulario QR).
 * @param {{ reunion_id: string, email: string, nombre?: string, bp_slug?: string, equipo_id?: number, equipo_label?: string, modalidad: 'Presencial'|'Online' }} row
 */
export async function insertAsistencia(row) {
  if (!supabase) return { ok: false, reason: 'supabase not configured' }
  const { error } = await supabase
    .from('asistencia_registros')
    .insert(row)
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' }
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}

/**
 * Fetch registros de una reunión (admin — authenticated).
 * @param {string} reunionId
 * @param {AbortSignal} [signal]
 */
export async function fetchRegistrosPorReunion(reunionId, signal) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('asistencia_registros')
    .select('*')
    .eq('reunion_id', reunionId)
    .order('registrado_en', { ascending: true })
    .abortSignal(signal)
  if (error) throw error
  return data ?? []
}

/**
 * Fetch conteos por equipo para una reunión (anon-safe via view).
 * @param {string} reunionId
 * @param {AbortSignal} [signal]
 */
export async function fetchConteosPorReunion(reunionId, signal) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('asistencia_conteo_por_equipo')
    .select('*')
    .eq('reunion_id', reunionId)
    .abortSignal(signal)
  if (error) throw error
  return data ?? []
}

/**
 * Fetch conteos de TODAS las reuniones no archivadas (para sumar puntos a la competencia).
 * @param {AbortSignal} [signal]
 */
export async function fetchConteosGlobal(signal) {
  if (!supabase) return []
  const { data: reuniones, error: reunionesErr } = await supabase
    .from('asistencia_reuniones_config')
    .select('id, fecha_evento, qr_generated_at, created_at')
    .eq('archivada', false)
    .abortSignal(signal)
  if (reunionesErr) throw reunionesErr
  const ids = (reuniones ?? []).filter(reunionCuentaParaPuntos).map((r) => r.id)
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('asistencia_conteo_por_equipo')
    .select('*')
    .in('reunion_id', ids)
    .abortSignal(signal)
  if (error) throw error
  return data ?? []
}
