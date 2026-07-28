import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'
import { reservaMatchesBroker } from './brokerReservaMatch.js'
import { asesorStorageKey, reservasEnCompetencia } from './competenciaCapitalOpenIndividual.js'

/** @returns {string | null} id de equipo como string */
export function equipoIdForNivelPlataforma(nivelJerarquiaNombre) {
  const nivel = String(nivelJerarquiaNombre ?? '').trim()
  if (!nivel) return null
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      if ((b.nombresPlataforma || []).includes(nivel)) {
        return String(eq.id)
      }
    }
  }
  return null
}

export function equipoLabelForId(equipoId) {
  if (equipoId == null) return null
  const eq = EQUIPOS_CAPITAL_ONE.find((e) => String(e.id) === String(equipoId))
  return eq?.label ?? null
}

/** Equipo del broker que coincide con la reserva (plataforma, email o slug). */
export function equipoIdForReserva(r) {
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      if (reservaMatchesBroker(r, b)) return String(eq.id)
    }
  }
  return equipoIdForNivelPlataforma(r?.nivel_jerarquia_nombre)
}

/** Equipo según el BP con más reservas del asesor en competencia. */
export function equipoIdForReservasAsesor(reservasAsesor) {
  const votes = new Map()
  for (const r of reservasAsesor ?? []) {
    const id = equipoIdForReserva(r)
    if (!id) continue
    votes.set(id, (votes.get(id) || 0) + 1)
  }
  let bestId = null
  let bestN = 0
  for (const [id, n] of votes) {
    if (n > bestN) {
      bestN = n
      bestId = id
    }
  }
  return bestId
}

/**
 * Suma al equipo lo que se cargo a mano en cada asesor: promesas, escrituras y
 * la diferencia que introduce un ajuste manual de reservas.
 *
 * `reservasDelta` es la correccion respecto del conteo automatico. Si un asesor
 * cuenta 12 por API y se ajusta a 15, el equipo suma +3; si se ajusta a 10,
 * suma -3. Asi la pestana de equipos no contradice a la individual.
 *
 * Limitacion conocida: solo cubre a los asesores que tienen reservas en la
 * ventana. Un ajuste sobre alguien con 0 reservas automaticas se ve en la
 * pestana individual pero no llega al equipo, porque no hay reserva de la cual
 * deducir a que equipo pertenece.
 *
 * @param {object[]} reservas
 * @param {Record<string, { promesasCount?: number, escriturasCount?: number, reservasOverride?: number|null }>} individualManual
 */
export function aggregateManualIndividualPorEquipo(reservas, individualManual) {
  const out = Object.fromEntries(
    EQUIPOS_CAPITAL_ONE.map((e) => [
      String(e.id),
      { promesasCount: 0, escriturasCount: 0, reservasDelta: 0 },
    ])
  )

  const inComp = reservasEnCompetencia(reservas ?? [])
  const porAsesor = new Map()
  for (const r of inComp) {
    const key = asesorStorageKey(r)
    if (!porAsesor.has(key)) porAsesor.set(key, [])
    porAsesor.get(key).push(r)
  }

  for (const [key, reservasAsesor] of porAsesor) {
    const equipoId = equipoIdForReservasAsesor(reservasAsesor)
    if (!equipoId || !out[equipoId]) continue
    const entry = individualManual?.[key] || {}
    out[equipoId].promesasCount += Math.max(0, Number(entry.promesasCount) || 0)
    out[equipoId].escriturasCount += Math.max(0, Number(entry.escriturasCount) || 0)

    const override = entry.reservasOverride
    if (override !== null && override !== undefined) {
      const n = Number(override)
      if (Number.isFinite(n) && n >= 0) {
        out[equipoId].reservasDelta += Math.floor(n) - reservasAsesor.length
      }
    }
  }

  return out
}
