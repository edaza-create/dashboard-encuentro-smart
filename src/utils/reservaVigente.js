/**
 * Vigencia de una reserva para efectos de conteo y puntaje.
 *
 * Contexto: la API publica de ored no informa el estado de la reserva, asi que
 * una reserva caida llegaba indistinguible de una vigente y sumaba puntos igual.
 * Atlas Engine si lo informa (`event_kind: 'fallen'` → `revertida: true`), y ese
 * es el dato que se usa aca.
 *
 * Importante: esto aplica al CONTEO (ranking, puntos, cartera UF). La tabla de
 * reservas y el resumen siguen mostrandolas, con su etiqueta de estado.
 */

/** @param {{ revertida?: boolean, archivado?: boolean }} r */
export function esReservaVigente(r) {
  if (!r) return false
  return !r.revertida && !r.archivado
}

/**
 * Filtra a solo las reservas que cuentan.
 * @template {{ revertida?: boolean, archivado?: boolean }} T
 * @param {T[]} reservas
 * @returns {T[]}
 */
export function soloReservasVigentes(reservas) {
  if (!reservas?.length) return []
  return reservas.filter(esReservaVigente)
}
