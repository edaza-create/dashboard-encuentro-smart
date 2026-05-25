/**
 * Reglas de actividades Capital Open desde asistencia a reuniones (Google Forms).
 * Online: ≥80% del roster del equipo · Presencial: ≥50%
 * Cada umbral cumplido suma +1 evento → +15 pts (SCORING en competenciaCapitalOpenScore).
 */

import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'
import { rosterEmailsPorEquipoCapitalOpen } from './asesorMaestra.js'

export const THRESHOLD_ONLINE = 0.8
export const THRESHOLD_PRESENCIAL = 0.5

/**
 * @param {string|null|undefined} modalidad
 * @returns {'online'|'presencial'|null}
 */
export function parseModalidad(modalidad) {
  const t = String(modalidad ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (!t) return null
  if (/online|virtual|remot|zoom|meet|remoto/.test(t)) return 'online'
  if (/presencial|presencia|sala|oficina|terreno/.test(t)) return 'presencial'
  return null
}

/**
 * @typedef {Object} AsistenciaRow
 * @property {string} email
 * @property {string} reunion
 * @property {'online'|'presencial'} modalidad
 * @property {string|null} [equipo_id]
 */

/**
 * Asistencias de una reunión agrupadas por equipo Capital Open.
 * @param {AsistenciaRow[]} rows - solo filas de la misma reunión
 * @param {Map<string, Set<string>>} [rosterByEquipo]
 */
export function evaluarReunionActividades(rows, rosterByEquipo = rosterEmailsPorEquipoCapitalOpen()) {
  const reunion = rows[0]?.reunion ?? ''
  const porEquipo = new Map()

  for (const eq of EQUIPOS_CAPITAL_ONE) {
    const equipoId = String(eq.id)
    const roster = rosterByEquipo.get(equipoId) ?? new Set()
    const total = roster.size
    const onlineAsistentes = new Set()
    const presencialAsistentes = new Set()

    for (const r of rows) {
      if (!r.email || r.equipo_id !== equipoId) continue
      if (r.modalidad === 'online') onlineAsistentes.add(r.email)
      if (r.modalidad === 'presencial') presencialAsistentes.add(r.email)
    }

    const onlinePct = total > 0 ? onlineAsistentes.size / total : 0
    const presencialPct = total > 0 ? presencialAsistentes.size / total : 0

    porEquipo.set(equipoId, {
      reunion,
      equipo_id: equipoId,
      equipo_label: eq.label,
      roster_total: total,
      online_asistentes: onlineAsistentes.size,
      presencial_asistentes: presencialAsistentes.size,
      online_pct: onlinePct,
      presencial_pct: presencialPct,
      online_cumple: total > 0 && onlinePct >= THRESHOLD_ONLINE,
      presencial_cumple: total > 0 && presencialPct >= THRESHOLD_PRESENCIAL,
    })
  }

  return [...porEquipo.values()]
}

/**
 * Incrementa contadores de actividad en payload team manual (shape competenciaStorage).
 * @param {Record<string, object>} teams
 * @param {string} equipoId
 * @param {{ online?: boolean, presencial?: boolean }} flags
 */
export function bumpTeamActividadCounts(teams, equipoId, flags) {
  const id = String(equipoId)
  const prev = teams[id] ?? {
    promesasCount: 0,
    escriturasCount: 0,
    actividadOnlineCount: 0,
    actividadPresencialCount: 0,
  }
  return {
    ...teams,
    [id]: {
      ...prev,
      actividadOnlineCount: Math.min(
        999,
        (prev.actividadOnlineCount || 0) + (flags.online ? 1 : 0)
      ),
      actividadPresencialCount: Math.min(
        999,
        (prev.actividadPresencialCount || 0) + (flags.presencial ? 1 : 0)
      ),
    },
  }
}
