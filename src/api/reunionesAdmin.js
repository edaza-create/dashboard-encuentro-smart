import { supabase, supabaseConfigured } from '../data/supabaseClient.js'

const TABLE = 'asistencia_reuniones_config'

export function isReunionesEnabled() {
  return supabaseConfigured
}

/** @param {AbortSignal} [signal] */
export async function fetchReuniones(signal) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .abortSignal(signal)
  if (error) throw error
  return data ?? []
}

/** @param {{ nombre: string, tipo?: string, fecha_evento?: string, descripcion?: string, created_by?: string }} fields */
export async function createReunion(fields) {
  if (!supabase) return { ok: false, reason: 'supabase not configured' }
  const { data, error } = await supabase
    .from(TABLE)
    .insert(fields)
    .select()
    .single()
  if (error) return { ok: false, reason: error.message }
  return { ok: true, reunion: data }
}

/** @param {string} id @param {object} fields */
export async function updateReunion(id, fields) {
  if (!supabase) return { ok: false, reason: 'supabase not configured' }
  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return { ok: false, reason: error.message }
  return { ok: true, reunion: data }
}

/** @param {string} id — sets qr_generated_at = now(), resets cerrada_manual */
export async function generateQR(id) {
  return updateReunion(id, {
    qr_generated_at: new Date().toISOString(),
    cerrada_manual: false,
  })
}

/** @param {string} id */
export async function closeReunion(id) {
  return updateReunion(id, { cerrada_manual: true })
}

/** @param {string} id */
export async function archiveReunion(id) {
  return updateReunion(id, { archivada: true })
}

/** @param {string} id */
export async function unarchiveReunion(id) {
  return updateReunion(id, { archivada: false })
}

/** @param {string} id — only allowed if no registros exist */
export async function deleteReunion(id) {
  if (!supabase) return { ok: false, reason: 'supabase not configured' }
  const { count } = await supabase
    .from('asistencia_registros')
    .select('id', { count: 'exact', head: true })
    .eq('reunion_id', id)
  if (count > 0) return { ok: false, reason: 'No se puede eliminar una reunión con asistentes registrados' }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
