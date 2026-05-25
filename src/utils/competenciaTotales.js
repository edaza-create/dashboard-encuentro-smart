import { reservasEnVentanaCyber } from '../config/capitalOpen'
import { equiposOrdenadosPorPuntos } from './competenciaCapitalOpenScore'
import {
  listAsesoresCompetenciaIndividual,
  totalIndividual,
} from './competenciaCapitalOpenIndividual'
import { loadIndividualManualSaved, loadTeamManualSaved } from './competenciaStorage'

/**
 * Totales de puntos de competencia (equipos + individual) para la ventana Cyber.
 * Usa reservas del dashboard y puntos manuales guardados en localStorage.
 */
export function computeCompetenciaTotales(reservas) {
  const enCyber = reservasEnVentanaCyber(reservas ?? [])
  const teamManual = loadTeamManualSaved()
  const indManual = loadIndividualManualSaved()
  const rankingEquipos = equiposOrdenadosPorPuntos(enCyber, teamManual, indManual)
  const puntosEquipos = rankingEquipos.reduce((acc, row) => acc + row.total, 0)

  const asesores = listAsesoresCompetenciaIndividual(enCyber)
  const puntosIndividual = asesores.reduce((acc, a) => {
    const saved = indManual[a.key] || { promesasCount: 0, escriturasCount: 0 }
    return acc + totalIndividual(saved, a.reservas)
  }, 0)

  return {
    reservas: enCyber.length,
    puntosEquipos,
    puntosIndividual,
    puntosCompetencia: puntosEquipos + puntosIndividual,
  }
}
