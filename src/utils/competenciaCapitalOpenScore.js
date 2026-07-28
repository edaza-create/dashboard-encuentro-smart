import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'
import { reservaMatchesBroker } from './brokerReservaMatch.js'
import { aggregateManualIndividualPorEquipo } from './competenciaIndividualToEquipo.js'
import { compareRankingPorPuntosYUf } from './rankingCompare.js'
import { esReservaVigente } from './reservaVigente.js'
import { ufMontoPlanillaReserva } from './ufNormalize.js'

/** Reglas oficiales de la competencia Capital Open. */
export const SCORING = {
  reservaPorRegistro: 15,
  promesaPorRegistro: 30,
  escrituraPorRegistro: 45,
  actividadOnline: 15,
  actividadPresencial: 15,
}

/** Todos los `nivel_jerarquia_nombre` de plataforma que pertenecen a un equipo. */
export function allNombresPlataformaForEquipo(equipo) {
  const names = new Set()
  for (const b of equipo.brokers) {
    for (const n of b.nombresPlataforma || []) {
      if (n) names.add(n)
    }
  }
  return names
}

/**
 * Reservas en ventana cuyo broker está mapeado al equipo (cualquier BP del equipo).
 * Excluye las caídas: una reserva revertida no suma puntos.
 */
export function cuentaReservasEquipo(reservas, equipo) {
  if (!reservas?.length || !equipo?.brokers?.length) return 0
  return reservas.filter(
    (r) => esReservaVigente(r) && equipo.brokers.some((b) => reservaMatchesBroker(r, b))
  ).length
}

/** Suma UF de reservas vigentes del equipo (mismo criterio que cartera por asesor). */
export function ufTotalReservasEquipo(reservas, equipo) {
  if (!reservas?.length || !equipo?.brokers?.length) return 0
  let sum = 0
  for (const r of reservas) {
    if (!esReservaVigente(r)) continue
    if (!equipo.brokers.some((b) => reservaMatchesBroker(r, b))) continue
    sum += ufMontoPlanillaReserva(r)
  }
  return Math.round(sum * 100) / 100
}

/**
 * Reservas del equipo tras aplicar los ajustes manuales de sus asesores.
 * Mantiene la pestana de equipos coherente con la individual.
 */
export function cuentaReservasEquipoAjustada(reservas, equipo, individualManual = {}) {
  const auto = cuentaReservasEquipo(reservas, equipo)
  const delta =
    aggregateManualIndividualPorEquipo(reservas, individualManual)[String(equipo.id)]
      ?.reservasDelta ?? 0
  return Math.max(0, auto + delta)
}

export function puntosReservaAuto(reservas, equipo, individualManual = {}) {
  return cuentaReservasEquipoAjustada(reservas, equipo, individualManual) * SCORING.reservaPorRegistro
}

export function puntosManualEquipo(manual) {
  if (!manual) return { promesas: 0, escrituras: 0, actividades: 0 }
  const promesas = Math.max(0, Number(manual.promesasCount) || 0) * SCORING.promesaPorRegistro
  const escrituras = Math.max(0, Number(manual.escriturasCount) || 0) * SCORING.escrituraPorRegistro
  const online = Math.max(0, Number(manual.actividadOnlineCount) || 0) * SCORING.actividadOnline
  const presencial = Math.max(0, Number(manual.actividadPresencialCount) || 0) * SCORING.actividadPresencial
  const actividades = online + presencial
  return { promesas, escrituras, actividades }
}

/**
 * Promesas y escrituras efectivas del equipo: lo que suman sus asesores MAS lo
 * que se carga directo al equipo. Las actividades siempre son de equipo.
 *
 * El extra por equipo sirve para registrar promesas o escrituras que no estan
 * atribuidas a un asesor puntual, sin tener que inventar a quien asignarlas.
 */
export function manualEfectivoEquipo(reservas, equipo, teamManual, individualManual = {}) {
  const id = String(equipo.id)
  const fromIndividual = aggregateManualIndividualPorEquipo(reservas, individualManual)[id] || {
    promesasCount: 0,
    escriturasCount: 0,
  }
  const extraPromesas = Math.max(0, Number(teamManual?.promesasCount) || 0)
  const extraEscrituras = Math.max(0, Number(teamManual?.escriturasCount) || 0)
  return {
    promesasCount: fromIndividual.promesasCount + extraPromesas,
    escriturasCount: fromIndividual.escriturasCount + extraEscrituras,
    /** Desglose, para que la UI pueda mostrar de donde sale cada parte. */
    promesasDesdeAsesores: fromIndividual.promesasCount,
    escriturasDesdeAsesores: fromIndividual.escriturasCount,
    promesasExtraEquipo: extraPromesas,
    escriturasExtraEquipo: extraEscrituras,
    actividadOnlineCount: teamManual?.actividadOnlineCount ?? 0,
    actividadPresencialCount: teamManual?.actividadPresencialCount ?? 0,
  }
}

export function totalPuntosEquipo(reservas, equipo, teamManual, individualManual = {}, asistenciaPuntos = 0) {
  const auto = puntosReservaAuto(reservas, equipo, individualManual)
  const m = puntosManualEquipo(manualEfectivoEquipo(reservas, equipo, teamManual, individualManual))
  return auto + m.promesas + m.escrituras + m.actividades + asistenciaPuntos
}

export function equiposOrdenadosPorPuntos(reservas, manualByTeamId, individualManual = {}, asistenciaPuntosByTeamId = {}) {
  return [...EQUIPOS_CAPITAL_ONE]
    .map((equipo) => {
      const eid = String(equipo.id)
      const asistPts = asistenciaPuntosByTeamId[eid]?.total ?? 0
      return {
        equipo,
        total: totalPuntosEquipo(
          reservas,
          equipo,
          manualByTeamId[eid],
          individualManual,
          asistPts
        ),
        ufTotal: ufTotalReservasEquipo(reservas, equipo),
        display: equipo.label,
      }
    })
    .sort((a, b) => {
      const cmp = compareRankingPorPuntosYUf(a, b)
      if (cmp !== 0) return cmp
      return a.equipo.id - b.equipo.id
    })
    .map(({ equipo, total, ufTotal }) => ({ equipo, total, ufTotal }))
}
