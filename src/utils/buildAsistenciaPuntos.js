/**
 * Calcula puntos de asistencia por equipo, acumulados sobre todas las reuniones.
 *
 * Regla por reunión: +15 pts al equipo con **más asistentes** (online + presencial).
 * El formato en UI sigue siendo asistentes/roster (ej. 19/66); el % no otorga puntos.
 */

import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'

export const PTS_ASISTENCIA_REUNION = 15

/** @returns {'online'|'presencial'|null} */
export function normalizeModalidadAsistencia(modalidad) {
  const t = String(modalidad ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (!t) return null
  if (/online|virtual|remot|zoom|meet|remoto/.test(t)) return 'online'
  if (/presencial|presencia|sala|oficina|terreno/.test(t)) return 'presencial'
  return null
}

/** @param {Map<string, { online: number, presencial: number }>} countsByEquipo */
export function equiposLiderAsistentes(countsByEquipo) {
  let maxTotal = 0
  for (const counts of countsByEquipo.values()) {
    maxTotal = Math.max(maxTotal, counts.online + counts.presencial)
  }
  if (maxTotal === 0) return new Set()

  const winners = new Set()
  for (const [eid, counts] of countsByEquipo) {
    if (counts.online + counts.presencial === maxTotal) winners.add(eid)
  }
  return winners
}

function aggregateConteosPorEquipo(conteos) {
  const byEquipo = new Map()
  for (const row of conteos ?? []) {
    const eid = String(row.equipo_id)
    if (!eid) continue
    if (!byEquipo.has(eid)) byEquipo.set(eid, { online: 0, presencial: 0 })
    const entry = byEquipo.get(eid)
    const mod = normalizeModalidadAsistencia(row.modalidad)
    if (mod === 'online') entry.online += Number(row.total) || 0
    if (mod === 'presencial') entry.presencial += Number(row.total) || 0
  }
  return byEquipo
}

/** Cuenta cada registro de asistencia (más fiable en reportes en vivo). */
export function aggregateFromRegistros(registros) {
  const byEquipo = new Map()
  for (const row of registros ?? []) {
    const eid = String(row.equipo_id ?? '')
    if (!eid) continue
    if (!byEquipo.has(eid)) byEquipo.set(eid, { online: 0, presencial: 0 })
    const entry = byEquipo.get(eid)
    const mod = normalizeModalidadAsistencia(row.modalidad)
    if (mod === 'online') entry.online += 1
    if (mod === 'presencial') entry.presencial += 1
  }
  return byEquipo
}

function groupConteosPorReunion(conteos) {
  const byReunion = new Map()
  for (const row of conteos ?? []) {
    const rid = row.reunion_id
    if (!byReunion.has(rid)) byReunion.set(rid, [])
    byReunion.get(rid).push(row)
  }
  return byReunion
}

export function buildAsistenciaPuntos(conteos, rosterMap) {
  const result = {}

  for (const reunionConteos of groupConteosPorReunion(conteos).values()) {
    const byEquipo = aggregateConteosPorEquipo(reunionConteos)
    const winners = equiposLiderAsistentes(byEquipo)

    for (const eid of winners) {
      const roster = rosterMap.get(eid)
      if (!roster?.size) continue
      if (!result[eid]) result[eid] = { online: 0, presencial: 0, total: 0 }
      result[eid].total += PTS_ASISTENCIA_REUNION
    }
  }

  return result
}

/**
 * Breakdown para UNA reunión (reporte, panel en vivo, QR activo).
 *
 * @param {Array<object>} conteosOrRegistros — filas de view `asistencia_conteo_por_equipo` o `asistencia_registros`
 * @param {Map<string, Set<string>>} rosterMap
 * @param {{ fromRegistros?: boolean, equipos?: typeof EQUIPOS_CAPITAL_ONE }} [opts]
 */
export function breakdownReunion(conteosOrRegistros, rosterMap, opts = {}) {
  const equipos = opts.equipos ?? EQUIPOS_CAPITAL_ONE
  const byEquipo = opts.fromRegistros
    ? aggregateFromRegistros(conteosOrRegistros)
    : aggregateConteosPorEquipo(conteosOrRegistros)

  const winners = equiposLiderAsistentes(byEquipo)
  const maxParticipantes = winners.size
    ? Math.max(...[...winners].map((eid) => {
        const c = byEquipo.get(eid) ?? { online: 0, presencial: 0 }
        return c.online + c.presencial
      }))
    : 0

  const result = []
  for (const eq of equipos) {
    const eid = String(eq.id)
    const counts = byEquipo.get(eid) ?? { online: 0, presencial: 0 }
    const roster = rosterMap.get(eid)
    const rosterSize = roster ? roster.size : 0
    const asistentesTotal = counts.online + counts.presencial
    const onlinePct = rosterSize ? counts.online / rosterSize : 0
    const presencialPct = rosterSize ? counts.presencial / rosterSize : 0
    const ptsTotal = winners.has(eid) ? PTS_ASISTENCIA_REUNION : 0

    result.push({
      equipo_id: eid,
      equipo_label: eq.label,
      rosterSize,
      online: counts.online,
      presencial: counts.presencial,
      asistentesTotal,
      onlinePct,
      presencialPct,
      ptsOnline: 0,
      ptsPresencial: 0,
      ptsTotal,
      esLider: winners.has(eid),
    })
  }

  result.sort((a, b) => {
    if (b.asistentesTotal !== a.asistentesTotal) return b.asistentesTotal - a.asistentesTotal
    return a.equipo_label.localeCompare(b.equipo_label, 'es', { sensitivity: 'base' })
  })

  return { rows: result, winners: [...winners], maxParticipantes }
}
