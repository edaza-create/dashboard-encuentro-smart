/**
 * Calcula puntos de asistencia por equipo, acumulados sobre todas las reuniones.
 *
 * Regla por reunión: +15 pts al equipo con **más asistentes** (online + presencial).
 * El formato en UI sigue siendo asistentes/roster (ej. 19/66); el % no otorga puntos.
 *
 * @param {Array<{ reunion_id: string, equipo_id: number, modalidad: 'Presencial'|'Online', total: number }>} conteos
 * @param {Map<string, Set<string>>} rosterMap
 * @returns {{ [equipo_id: string]: { online: number, presencial: number, total: number } }}
 */
export const PTS_ASISTENCIA_REUNION = 15

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
  for (const row of conteos) {
    const eid = String(row.equipo_id)
    if (!byEquipo.has(eid)) byEquipo.set(eid, { online: 0, presencial: 0 })
    const entry = byEquipo.get(eid)
    if (row.modalidad === 'Online') entry.online += Number(row.total)
    if (row.modalidad === 'Presencial') entry.presencial += Number(row.total)
  }
  return byEquipo
}

function groupConteosPorReunion(conteos) {
  const byReunion = new Map()
  for (const row of conteos) {
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
 * Breakdown para UNA reunión (panel en vivo, reporte, QR activo).
 *
 * @param {Array<{ equipo_id: number, modalidad: string, total: number }>} conteos
 * @param {Map<string, Set<string>>} rosterMap
 */
export function breakdownReunion(conteos, rosterMap) {
  const byEquipo = aggregateConteosPorEquipo(conteos)
  const winners = equiposLiderAsistentes(byEquipo)

  const result = []
  for (const [eid, counts] of byEquipo) {
    const roster = rosterMap.get(eid)
    const rosterSize = roster ? roster.size : 0
    const asistentesTotal = counts.online + counts.presencial
    const onlinePct = rosterSize ? counts.online / rosterSize : 0
    const presencialPct = rosterSize ? counts.presencial / rosterSize : 0
    const ptsTotal = winners.has(eid) ? PTS_ASISTENCIA_REUNION : 0

    result.push({
      equipo_id: eid,
      rosterSize,
      online: counts.online,
      presencial: counts.presencial,
      asistentesTotal,
      onlinePct,
      presencialPct,
      ptsOnline: 0,
      ptsPresencial: 0,
      ptsTotal,
    })
  }

  return result
}
