import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams'
import { reservaMatchesBroker } from './brokerReservaMatch'
import { aggregateManualIndividualPorEquipo } from './competenciaIndividualToEquipo'

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

/** Reservas en ventana cuyo broker está mapeado al equipo (cualquier BP del equipo). */
export function cuentaReservasEquipo(reservas, equipo) {
  if (!reservas?.length || !equipo?.brokers?.length) return 0
  return reservas.filter((r) => equipo.brokers.some((b) => reservaMatchesBroker(r, b))).length
}

export function puntosReservaAuto(reservas, equipo) {
  return cuentaReservasEquipo(reservas, equipo) * SCORING.reservaPorRegistro
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

/** Promesas/escrituras del equipo = suma de asesores; actividades solo desde manual de equipo. */
export function manualEfectivoEquipo(reservas, equipo, teamManual, individualManual = {}) {
  const id = String(equipo.id)
  const fromIndividual = aggregateManualIndividualPorEquipo(reservas, individualManual)[id] || {
    promesasCount: 0,
    escriturasCount: 0,
  }
  return {
    promesasCount: fromIndividual.promesasCount,
    escriturasCount: fromIndividual.escriturasCount,
    actividadOnlineCount: teamManual?.actividadOnlineCount ?? 0,
    actividadPresencialCount: teamManual?.actividadPresencialCount ?? 0,
  }
}

export function totalPuntosEquipo(reservas, equipo, teamManual, individualManual = {}) {
  const auto = puntosReservaAuto(reservas, equipo)
  const m = puntosManualEquipo(manualEfectivoEquipo(reservas, equipo, teamManual, individualManual))
  return auto + m.promesas + m.escrituras + m.actividades
}

export function equiposOrdenadosPorPuntos(reservas, manualByTeamId, individualManual = {}) {
  return [...EQUIPOS_CAPITAL_ONE]
    .map((equipo) => ({
      equipo,
      total: totalPuntosEquipo(
        reservas,
        equipo,
        manualByTeamId[String(equipo.id)],
        individualManual
      ),
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.equipo.id - b.equipo.id
    })
}
