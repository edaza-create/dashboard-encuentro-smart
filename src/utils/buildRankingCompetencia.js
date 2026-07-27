/**
 * Ranking público con el mismo sistema de puntos que el dashboard (competencia individual / equipos).
 * Lee promesas y escrituras desde caché remota (Supabase) o localStorage del dashboard admin.
 */

import { mergeFotoFromReserva, pickAvatarSrc } from './buildRanking.js'
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
import { esReservaVigente } from './reservaVigente.js'
import { canonicalAsesorEmail } from './asesorEmail.js'

/**
 * Mapa email → foto a partir de filas crudas de ored.
 * Atlas no entrega avatares, asi que ored se sigue consultando solo para esto.
 */
export function buildFotoByEmail(reservasPublicas) {
  const map = new Map()
  for (const r of reservasPublicas ?? []) {
    const email = canonicalAsesorEmail(r.asesor_email)
    if (!email) continue
    const merged = mergeFotoFromReserva(map.get(email), r)
    if (merged) {
      map.set(email, { foto_url: merged.foto_url, foto_urls: merged.foto_urls })
    }
  }
  return map
}

/** @param {{ user_email?: string, nombre_asesor?: string }} r reserva ya mapeada */
function reservaTieneBpAsignado(r) {
  const email = canonicalAsesorEmail(r.user_email)
  if (email && lookupAsesorBp(email).bp_slug) return true
  if (miembroPorNombre(r.nombre_asesor)) return true
  return false
}

/** Asesores con reservas vigentes pero sin BP mapeado: senal de roster desactualizado. */
function buildHuerfanos(reservas) {
  const porEmail = new Map()
  for (const r of reservas ?? []) {
    if (!esReservaVigente(r)) continue
    if (reservaTieneBpAsignado(r)) continue
    const email =
      canonicalAsesorEmail(r.user_email) ??
      `nombre:${String(r.nombre_asesor ?? '').trim().toLowerCase()}`
    if (!porEmail.has(email)) {
      porEmail.set(email, {
        email: canonicalAsesorEmail(r.user_email) ?? email,
        nombre: r.nombre_asesor ?? null,
        total: 0,
      })
    }
    porEmail.get(email).total += 1
  }
  return [...porEmail.values()].sort((a, b) => b.total - a.total)
}

/**
 * Construye el ranking de competencia.
 *
 * Acepta filas crudas de ored (compatibilidad) o reservas ya mapeadas de
 * cualquier fuente. Con Atlas se pasan mapeadas y las fotos aparte, porque
 * Atlas no entrega avatares.
 *
 * @param {import('../api/rankingClient.js').ReservaPublica[]} reservasPublicas
 * @param {{ reservas?: object[], fotos?: Map<string, {foto_url: string|null, foto_urls: object|null}> }} [options]
 */
export function buildRankingCompetencia(reservasPublicas, options = {}) {
  const reservas =
    options.reservas ?? (reservasPublicas ?? []).map(mapReservaPublica).filter(Boolean)
  const fotos = options.fotos ?? buildFotoByEmail(reservasPublicas)
  const indManual = loadIndividualManualSaved()
  const teamManual = loadTeamManualSaved()

  const asesoresBase = listAsesoresCompetenciaIndividual(reservas)
  const asesores = asesoresBase
    .map((a) => {
      const saved = indManual[a.key] || { promesasCount: 0, escriturasCount: 0 }
      const pm = puntosManualIndividual(saved)
      const emailKey = canonicalAsesorEmail(a.email)
      const foto = emailKey ? fotos.get(emailKey) : null
      return {
        // Clave estable y única en la lista (indexada por asesorStorageKey);
        // sirve de React key robusto aunque dos filas compartieran email.
        key: a.key,
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

  const huerfanos = buildHuerfanos(reservas)

  return { asesores, bps, huerfanos, scoring: SCORING }
}

/** Re-export para la UI pública */
export { avatarUrlWithCacheBust, pickAvatarSrc } from './buildRanking.js'
