/**
 * Deduplicacion de reservas por evento.
 *
 * Atlas Engine es event-based: emite UNA FILA POR EVENTO, no por reserva. Una
 * reserva que se creo y despues se cayo aparece dos veces —como `created` y
 * como `fallen`— y ambas comparten `brekto_id`.
 *
 * Si no se deduplica, filtrar solo las filas caidas deja viva la fila `created`
 * de esa misma reserva, que sigue sumando puntos. En la ventana Cyber eso eran
 * 59 reservas caidas puntuando igual: 885 puntos de mas.
 *
 * El proxy `reservas-atlas` ya deduplica del lado del servidor; esto es una
 * segunda linea de defensa por si llegara a responder sin deduplicar.
 *
 * Regla: una reserva caida es terminal. Si cualquiera de sus eventos dice que se
 * cayo, la reserva esta caida sin importar que otros eventos tenga. Entre los
 * demas gana el mas reciente.
 */

/** Clave de identidad de la reserva. Sin `brekto_id` no se puede agrupar. */
function claveReserva(r) {
  const brekto = r?.brekto_id
  if (brekto == null || String(brekto).trim() === '') return null
  return String(brekto).trim()
}

function timestamp(r) {
  const t = Date.parse(r?.created_at ?? '')
  return Number.isFinite(t) ? t : 0
}

/**
 * Colapsa las filas de evento en una fila por reserva.
 *
 * Las reservas sin `brekto_id` se dejan pasar tal cual: agruparlas por otros
 * campos seria inseguro, porque un asesor puede tener varias reservas legitimas
 * el mismo dia, por el mismo monto y en el mismo proyecto.
 *
 * @template {{ brekto_id?: string|null, revertida?: boolean, created_at?: string|null }} T
 * @param {T[]} reservas
 * @returns {T[]}
 */
export function dedupeReservasPorEvento(reservas) {
  if (!reservas?.length) return []

  const porReserva = new Map()
  const sinClave = []

  for (const r of reservas) {
    const clave = claveReserva(r)
    if (clave === null) {
      sinClave.push(r)
      continue
    }

    const previa = porReserva.get(clave)
    if (!previa) {
      porReserva.set(clave, r)
      continue
    }
    if (previa.revertida) continue // terminal: nada la reemplaza
    if (r.revertida) {
      porReserva.set(clave, r)
      continue
    }
    if (timestamp(r) > timestamp(previa)) porReserva.set(clave, r)
  }

  return [...porReserva.values(), ...sinClave]
}
