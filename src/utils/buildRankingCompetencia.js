/**
 * Ranking público con el mismo sistema de puntos que el dashboard (competencia individual / equipos).
 * Lee promesas y escrituras desde caché remota (Supabase) o localStorage del dashboard admin.
 */

import asesoresBP from '../data/asesores-bp.json'
import { pickAvatarSrc } from './buildRanking.js'
import { mapReservaPublica } from './mapReserva.js'
import {
  listAsesoresCompetenciaIndividual,
  puntosManualIndividual,
  totalIndividual,
} from './competenciaCapitalOpenIndividual.js'
import {
  equiposOrdenadosPorPuntos,
  cuentaReservasEquipo,
  manualEfectivoEquipo,
  puntosManualEquipo,
  SCORING,
} from './competenciaCapitalOpenScore.js'
import { loadIndividualManualSaved, loadTeamManualSaved } from './competenciaStorage.js'

const SIN_BP_SLUG = 'sin-bp'

function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  return trimmed || null
}

function buildFotoByEmail(reservasPublicas) {
  const map = new Map()
  for (const r of reservasPublicas ?? []) {
    const email = normalizeEmail(r.asesor_email)
    if (!email || map.has(email)) continue
    map.set(email, {
      foto_url: r.asesor_foto_url ?? null,
      foto_urls: r.asesor_foto_urls ?? null,
    })
  }
  return map
}

function buildHuerfanos(reservasPublicas) {
  const emailToBp = new Map()
  for (const a of asesoresBP.asesores) {
    emailToBp.set(a.email.toLowerCase(), a.bp_slug)
  }
  const porEmail = new Map()
  for (const r of reservasPublicas ?? []) {
    const email = normalizeEmail(r.asesor_email)
    if (!email) continue
    const slug = emailToBp.get(email) ?? SIN_BP_SLUG
    if (slug !== SIN_BP_SLUG) continue
    if (!porEmail.has(email)) {
      porEmail.set(email, { email, nombre: r.asesor_nombre ?? null, total: 0 })
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
    .sort((x, y) => {
      if (y.totalPuntos !== x.totalPuntos) return y.totalPuntos - x.totalPuntos
      return x.nombre.localeCompare(y.nombre, 'es', { sensitivity: 'base' })
    })

  const rankingEquipos = equiposOrdenadosPorPuntos(reservas, teamManual, indManual)
  const bps = rankingEquipos.map(({ equipo, total }) => {
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
    }
  })

  const huerfanos = buildHuerfanos(reservasPublicas)

  return { asesores, bps, huerfanos, scoring: SCORING }
}

/** Re-export para la UI pública */
export { pickAvatarSrc }
