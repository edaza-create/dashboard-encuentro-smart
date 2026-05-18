import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams'

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
  const set = allNombresPlataformaForEquipo(equipo)
  if (set.size === 0 || !reservas?.length) return 0
  return reservas.filter((r) => set.has(r.nivel_jerarquia_nombre)).length
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

export function totalPuntosEquipo(reservas, equipo, manual) {
  const auto = puntosReservaAuto(reservas, equipo)
  const m = puntosManualEquipo(manual)
  return auto + m.promesas + m.escrituras + m.actividades
}

export function equiposOrdenadosPorPuntos(reservas, manualByTeamId) {
  return [...EQUIPOS_CAPITAL_ONE]
    .map((equipo) => ({
      equipo,
      total: totalPuntosEquipo(reservas, equipo, manualByTeamId[String(equipo.id)]),
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.equipo.id - b.equipo.id
    })
}
