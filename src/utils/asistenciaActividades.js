/**
 * Reglas de actividades Capital Open desde asistencia a reuniones (Google Forms).
 * Por reunión: gana el equipo con más asistentes (online + presencial) → +15 pts.
 */

import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'
import { rosterEmailsPorEquipoCapitalOpen } from './asesorMaestra.js'
import { equiposLiderAsistentes, PTS_ASISTENCIA_REUNION } from './buildAsistenciaPuntos.js'

/** @deprecated Solo referencia histórica en copy; los puntos ya no usan % */
export const THRESHOLD_ONLINE = 0.8
/** @deprecated Solo referencia histórica en copy; los puntos ya no usan % */
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

  const countsByEquipo = new Map()

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

    const online = onlineAsistentes.size
    const presencial = presencialAsistentes.size
    countsByEquipo.set(equipoId, { online, presencial })

    const onlinePct = total > 0 ? online / total : 0
    const presencialPct = total > 0 ? presencial / total : 0

    porEquipo.set(equipoId, {
      reunion,
      equipo_id: equipoId,
      equipo_label: eq.label,
      roster_total: total,
      online_asistentes: online,
      presencial_asistentes: presencial,
      asistentes_total: online + presencial,
      online_pct: onlinePct,
      presencial_pct: presencialPct,
      online_cumple: false,
      presencial_cumple: false,
      gana_puntos: false,
    })
  }

  const winners = equiposLiderAsistentes(countsByEquipo)
  for (const eid of winners) {
    const row = porEquipo.get(eid)
    if (row) {
      row.gana_puntos = true
      row.puntos = PTS_ASISTENCIA_REUNION
    }
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
