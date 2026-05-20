import { supabase, supabaseConfigured } from '../data/supabaseClient.js'

export const ASISTENCIA_TABLE = 'encuentro_asistencia_reunion'
export const ASISTENCIA_AWARD_TABLE = 'encuentro_reunion_actividad_award'

export function isAsistenciaRemoteEnabled() {
  return supabaseConfigured
}

/**
 * @param {AbortSignal} [signal]
 */
export async function fetchAsistenciaReuniones(signal) {
  if (!supabaseConfigured || !supabase) return { rows: [], awards: [] }

  const q1 = supabase
    .from(ASISTENCIA_TABLE)
    .select('id, email, nombre, subgrupo, equipo, modalidad, reunion, registrado_en, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  const q2 = supabase
    .from(ASISTENCIA_AWARD_TABLE)
    .select('reunion, equipo_id, actividad_tipo, online_pct, presencial_pct, roster_total, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const [r1, r2] = await Promise.all([signal ? q1.abortSignal(signal) : q1, signal ? q2.abortSignal(signal) : q2])

  if (r1.error) throw new Error(r1.error.message)
  if (r2.error) throw new Error(r2.error.message)

  return { rows: r1.data ?? [], awards: r2.data ?? [] }
}
