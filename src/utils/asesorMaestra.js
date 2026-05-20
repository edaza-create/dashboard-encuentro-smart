/**
 * Resolución de asesor desde la maestra (asesores-bp + equipo comercial interno).
 * Usado por webhook de asistencia Forms y recálculo de actividades.
 */

import asesoresBP from '../data/asesores-bp.json' with { type: 'json' }
import { lookupAsesorBp } from './asesorBpPlataforma.js'
import { BP_SLUG_EQUIPO_INTERNO } from '../data/equipoComercialInterno.js'
import { equipoIdForNivelPlataforma, equipoLabelForId } from './competenciaIndividualToEquipo.js'

const bpDisplayBySlug = new Map(
  (asesoresBP.business_partners ?? []).map((bp) => [bp.slug, bp.display ?? bp.slug])
)

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const t = email.trim().toLowerCase()
  return t && t.includes('@') ? t : null
}

/**
 * @param {string} email
 * @returns {{
 *   ok: true,
 *   asesor_id: string,
 *   email: string,
 *   nombre: string | null,
 *   subgrupo: string,
 *   bp_slug: string,
 *   equipo_id: string | null,
 *   equipo: string | null,
 * } | { ok: false, email: string }}
 */
export function resolveAsesorMaestra(email) {
  const key = normalizeEmail(email)
  if (!key) return { ok: false, email: String(email ?? '') }

  const row = lookupAsesorBp(key)
  if (!row.bp_slug) return { ok: false, email: key }

  const subgrupo =
    row.bp_slug === BP_SLUG_EQUIPO_INTERNO
      ? 'Equipo Comercial Interno'
      : bpDisplayBySlug.get(row.bp_slug) ?? row.bp_slug

  const equipo_id = equipoIdForNivelPlataforma(row.nivel_jerarquia_nombre)
  const equipo = equipo_id ? equipoLabelForId(equipo_id) : null

  return {
    ok: true,
    asesor_id: `email:${key}`,
    email: key,
    nombre: row.nombre ?? null,
    subgrupo,
    bp_slug: row.bp_slug,
    equipo_id,
    equipo,
  }
}

/**
 * Roster de emails ACTIVOS por equipo Capital Open (denominador % asistencia).
 * Excluye asesores sin equipo mapeado (p. ej. solo BP sin match en competencia).
 * @returns {Map<string, Set<string>>} equipoId → emails
 */
export function rosterEmailsPorEquipoCapitalOpen() {
  const map = new Map()
  for (const a of asesoresBP.asesores ?? []) {
    if (a.estado && a.estado !== 'ACTIVO') continue
    const key = normalizeEmail(a.email)
    if (!key) continue
    const resolved = resolveAsesorMaestra(key)
    if (!resolved.ok || !resolved.equipo_id) continue
    if (!map.has(resolved.equipo_id)) map.set(resolved.equipo_id, new Set())
    map.get(resolved.equipo_id).add(key)
  }
  return map
}
