/**
 * Ranking público con el mismo sistema de puntos que el dashboard (competencia individual / equipos).
 * Lee promesas y escrituras desde caché remota (Supabase) o localStorage del dashboard admin.
 */

import { pickAvatarSrc } from './buildRanking.js'
import { lookupAsesorBp } from './asesorBpPlataforma.js'
import { miembroPorNombre } from './equipoComercialInterno.js'
import { mapReservaPublica } from './mapReserva.js'
import {
  listAsesoresCompetenciaIndividual,
  puntosManualIndividual,
  totalIndividual,
} from './competenciaCapitalOpenIndividual.js'
import { compareRankingPorPuntosYUf } from './rankingCompare.js'
import {
  equiposOrdenadosPorPuntos,
  cuentaReservasEquipo,
  manualEfectivoEquipo,
  puntosManualEquipo,
  SCORING,
} from './competenciaCapitalOpenScore.js'
import { loadIndividualManualSaved, loadTeamManualSaved } from './competenciaStorage.js'
import { canonicalAsesorEmail } from './asesorEmail.js'

function buildFotoByEmail(reservasPublicas) {
  const map = new Map()
  for (const r of reservasPublicas ?? []) {
    const email = canonicalAsesorEmail(r.asesor_email)
    if (!email || map.has(email)) continue
    map.set(email, {
      foto_url: r.asesor_foto_url ?? null,
      foto_urls: r.asesor_foto_urls ?? null,
    })
  }
  return map
}

function reservaTieneBpAsignado(r) {
  const email = canonicalAsesorEmail(r.asesor_email)
  if (email && lookupAsesorBp(email).bp_slug) return true
  if (miembroPorNombre(r.asesor_nombre)) return true
  return false
}

function buildHuerfanos(reservasPublicas) {
  const porEmail = new Map()
  for (const r of reservasPublicas ?? []) {
    if (reservaTieneBpAsignado(r)) continue
    const email = canonicalAsesorEmail(r.asesor_email) ?? `nombre:${String(r.asesor_nombre ?? '').trim().toLowerCase()}`
    if (!porEmail.has(email)) {
      porEmail.set(email, { email: canonicalAsesorEmail(r.asesor_email) ?? email, nombre: r.asesor_nombre ?? null, total: 0 })
    }
    porEmail.get(email).total += 1
  }
  return [...porEmail.values()].sort((a, b) => b.total - a.total)
}

/**
 * @param {import('../api/rankingClient.js').ReservaPublica[]} reservasPublicas
 */
export function buildRankingCompetencia(reservasPublicas) {
  const reservas = (reservasPublicas ?? []).map(mapReservaPublica).filter(Boolean)
  const fotos = buildFotoByEmail(reservasPublicas)
  const indManual = loadIndividualManualSaved()
  const teamManual = loadTeamManualSaved()

  const asesoresBase = listAsesoresCompetenciaIndividual(reservas)
  const asesores = asesoresBase
    .map((a) => {
      const saved = indManual[a.key] || { promesasCount: 0, escriturasCount: 0 }
      const pm = puntosManualIndividual(saved)
      const emailKey = a.email?.toLowerCase()
      const foto = emailKey ? fotos.get(emailKey) : null
      return {
        email: a.email,
        nombre: a.etiqueta,
        bp_display: a.nivelJerarquia,
        reservasCount: a.reservas,
        promesasCount: saved.promesasCount,
        escriturasCount: saved.escriturasCount,
        puntosReserva: a.puntosReserva,
        puntosPromesas: pm.promesas,
        puntosEscrituras: pm.escrituras,
        totalPuntos: totalIndividual(saved, a.reservas),
        ufTotal: a.ufTotal ?? 0,
        foto_url: foto?.foto_url ?? null,
        foto_urls: foto?.foto_urls ?? null,
      }
    })
    .sort(compareRankingPorPuntosYUf)

  const rankingEquipos = equiposOrdenadosPorPuntos(reservas, teamManual, indManual)
  const bps = rankingEquipos.map(({ equipo, total, ufTotal }) => {
    const id = String(equipo.id)
    const teamOnly = teamManual[id] || {
      actividadOnlineCount: 0,
      actividadPresencialCount: 0,
    }
    const manual = manualEfectivoEquipo(reservas, equipo, teamOnly, indManual)
    const pm = puntosManualEquipo(manual)
    const nRes = cuentaReservasEquipo(reservas, equipo)
    return {
      slug: id,
      display: equipo.label,
      reservasCount: nRes,
      promesasCount: manual.promesasCount,
      escriturasCount: manual.escriturasCount,
      actividadOnlineCount: manual.actividadOnlineCount ?? 0,
      actividadPresencialCount: manual.actividadPresencialCount ?? 0,
      puntosReserva: nRes * SCORING.reservaPorRegistro,
      puntosPromesas: pm.promesas,
      puntosEscrituras: pm.escrituras,
      puntosActividades: pm.actividades,
      totalPuntos: total,
      ufTotal: ufTotal ?? 0,
    }
  })

  const huerfanos = buildHuerfanos(reservasPublicas)

  return { asesores, bps, huerfanos, scoring: SCORING }
}

/** Re-export para la UI pública */
export { pickAvatarSrc }
