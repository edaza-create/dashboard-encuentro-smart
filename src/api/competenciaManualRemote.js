import { supabase, supabaseConfigured } from '../data/supabaseClient.js'
import {
  readIndividualManualPayload,
  readTeamManualPayload,
} from '../utils/competenciaStorage.js'

export const COMPETENCIA_MANUAL_TABLE = 'encuentro_competencia_manual'

/** @typedef {'individual' | 'team'} CompetenciaManualScope */

/**
 * @typedef {Object} CompetenciaManualRemoteSnapshot
 * @property {object | null} individualRaw
 * @property {object | null} teamRaw
 * @property {string | null} individualUpdatedAt
 * @property {string | null} teamUpdatedAt
 */

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<CompetenciaManualRemoteSnapshot | null>}
 */
export async function fetchCompetenciaManualRemote(signal) {
  if (!supabaseConfigured || !supabase) return null

  const query = supabase.from(COMPETENCIA_MANUAL_TABLE).select('scope, data, updated_at')
  const { data, error } = signal ? await query.abortSignal(signal) : await query

  if (error) throw new Error(error.message || 'Error al leer puntos de competencia')

  /** @type {CompetenciaManualRemoteSnapshot} */
  const out = {
    individualRaw: null,
    teamRaw: null,
    individualUpdatedAt: null,
    teamUpdatedAt: null,
  }

  for (const row of data ?? []) {
    if (row.scope === 'individual') {
      out.individualRaw = row.data ?? null
      out.individualUpdatedAt = row.updated_at ?? null
    } else if (row.scope === 'team') {
      out.teamRaw = row.data ?? null
      out.teamUpdatedAt = row.updated_at ?? null
    }
  }

  return out
}

/**
 * @param {CompetenciaManualScope} scope
 * @param {object} payload
 */
export async function pushCompetenciaManualRemote(scope, payload) {
  if (!supabaseConfigured || !supabase) return { ok: false, reason: 'not_configured' }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { ok: false, reason: 'not_authenticated' }

  const updated_at = new Date().toISOString()
  const { error } = await supabase.from(COMPETENCIA_MANUAL_TABLE).upsert(
    { scope, data: payload, updated_at },
    { onConflict: 'scope' }
  )

  if (error) return { ok: false, reason: error.message }
  return { ok: true, updatedAt: updated_at }
}

export function isCompetenciaManualRemoteEnabled() {
  return supabaseConfigured
}

/** Mensaje legible para UI cuando falla el push remoto. */
export function remotePushReasonMessage(reason) {
  switch (reason) {
    case 'not_configured':
      return 'Supabase no está configurado (faltan SUPABASE_URL / SUPABASE_ANON_KEY).'
    case 'not_authenticated':
      return 'Inicia sesión con un correo administrador para publicar en /cyber.'
    default:
      return typeof reason === 'string' ? reason : 'No se pudo publicar en el ranking público.'
  }
}

/**
 * Publica individual + equipos desde localStorage (útil tras migrar datos locales).
 * @returns {Promise<{ ok: boolean, reason?: string, updatedAt?: string }>}
 */
export async function publishAllCompetenciaManualToRemote() {
  const r1 = await pushCompetenciaManualRemote('individual', readIndividualManualPayload())
  if (!r1.ok) return r1
  const r2 = await pushCompetenciaManualRemote('team', readTeamManualPayload())
  if (!r2.ok) return r2
  return { ok: true, updatedAt: r2.updatedAt ?? r1.updatedAt }
}
