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

/**
 * Estados que representan una reserva caida y por lo tanto no puntuan.
 *
 * `Cancelado` y `Rechazado` son los documentados por ORED. Se incluyen tambien
 * las variantes de "revertida" y "anulada" —con sus formas masculina y
 * femenina— porque son etiquetas que aparecen en Brekto y en la UI del
 * dashboard; asi cuentan como caida venga el dato como venga.
 *
 * Ojo con la trampa: `Pendiente` NO es "a medio procesar", es la reserva viva
 * (la UI de Brekto la muestra como "Reservado"). `Procesando` es un tramite en
 * curso y tambien cuenta.
 *
 * Ver docs/API-ranking-ored.md seccion 4.
 */
const ESTADOS_CAIDA = new Set([
  'cancelado',
  'cancelada',
  'rechazado',
  'rechazada',
  'revertido',
  'revertida',
  'anulado',
  'anulada',
])

/** @param {string|null|undefined} estado */
export function estadoEsCaida(estado) {
  if (!estado) return false
  return ESTADOS_CAIDA.has(String(estado).trim().toLowerCase())
}

/** @param {{ revertida?: boolean, archivado?: boolean, estado?: string }} r */
export function esReservaVigente(r) {
  if (!r) return false
  if (r.revertida || r.archivado) return false
  return !estadoEsCaida(r.estado)
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
