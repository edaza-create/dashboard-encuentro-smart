/**
 * Calcula puntos de asistencia por equipo, acumulados sobre todas las reuniones.
 *
 * Umbrales por reunión:
 *  - ≥ 80% Online  → +15 pts
 *  - ≥ 50% Presencial → +15 pts
 *
 * @param {Array<{ reunion_id: string, equipo_id: number, modalidad: 'Presencial'|'Online', total: number }>} conteos
 *   — filas de la view asistencia_conteo_por_equipo (puede incluir múltiples reuniones)
 * @param {Map<string, Set<string>>} rosterMap
 *   — equipoId → Set de emails activos (de rosterEmailsPorEquipoCapitalOpen)
 * @returns {{ [equipo_id: string]: { online: number, presencial: number, total: number } }}
 */
export function buildAsistenciaPuntos(conteos, rosterMap) {
  const THRESHOLD_ONLINE = 0.8
  const THRESHOLD_PRESENCIAL = 0.5
  const PTS = 15

  const byReunionEquipo = new Map()
  for (const row of conteos) {
    const key = `${row.reunion_id}::${row.equipo_id}`
    if (!byReunionEquipo.has(key)) {
      byReunionEquipo.set(key, { reunion_id: row.reunion_id, equipo_id: String(row.equipo_id), online: 0, presencial: 0 })
    }
    const entry = byReunionEquipo.get(key)
    if (row.modalidad === 'Online') entry.online += Number(row.total)
    if (row.modalidad === 'Presencial') entry.presencial += Number(row.total)
  }

  const result = {}

  for (const entry of byReunionEquipo.values()) {
    const roster = rosterMap.get(entry.equipo_id)
    const rosterSize = roster ? roster.size : 0
    if (rosterSize === 0) continue

    const onlinePct = entry.online / rosterSize
    const presencialPct = entry.presencial / rosterSize

    if (!result[entry.equipo_id]) {
      result[entry.equipo_id] = { online: 0, presencial: 0, total: 0 }
    }

    if (onlinePct >= THRESHOLD_ONLINE) {
      result[entry.equipo_id].online += PTS
      result[entry.equipo_id].total += PTS
    }
    if (presencialPct >= THRESHOLD_PRESENCIAL) {
      result[entry.equipo_id].presencial += PTS
      result[entry.equipo_id].total += PTS
    }
  }

  return result
}

/**
 * Calcula breakdown detallado para UNA reunión (útil para panel en vivo y reporte).
 *
 * @param {Array<{ equipo_id: number, modalidad: string, total: number }>} conteos — de UNA reunión
 * @param {Map<string, Set<string>>} rosterMap
 * @returns {Array<{ equipo_id: string, rosterSize: number, online: number, presencial: number, onlinePct: number, presencialPct: number, ptsOnline: number, ptsPresencial: number, ptsTotal: number }>}
 */
export function breakdownReunion(conteos, rosterMap) {
  const THRESHOLD_ONLINE = 0.8
  const THRESHOLD_PRESENCIAL = 0.5
  const PTS = 15

  const byEquipo = new Map()
  for (const row of conteos) {
    const eid = String(row.equipo_id)
    if (!byEquipo.has(eid)) byEquipo.set(eid, { online: 0, presencial: 0 })
    const e = byEquipo.get(eid)
    if (row.modalidad === 'Online') e.online += Number(row.total)
    if (row.modalidad === 'Presencial') e.presencial += Number(row.total)
  }

  const result = []
  for (const [eid, counts] of byEquipo) {
    const roster = rosterMap.get(eid)
    const rosterSize = roster ? roster.size : 0
    const onlinePct = rosterSize ? counts.online / rosterSize : 0
    const presencialPct = rosterSize ? counts.presencial / rosterSize : 0
    const ptsOnline = onlinePct >= THRESHOLD_ONLINE ? PTS : 0
    const ptsPresencial = presencialPct >= THRESHOLD_PRESENCIAL ? PTS : 0
    result.push({
      equipo_id: eid,
      rosterSize,
      online: counts.online,
      presencial: counts.presencial,
      onlinePct,
      presencialPct,
      ptsOnline,
      ptsPresencial,
      ptsTotal: ptsOnline + ptsPresencial,
    })
  }

  return result
}
