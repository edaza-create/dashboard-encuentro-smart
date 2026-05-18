/** Devuelve YYYY-MM-DD o null si no hay fecha válida. */
export function parseReservaFechaISO(fecha_reserva) {
  if (fecha_reserva == null || fecha_reserva === '') return null
  const s = String(fecha_reserva).trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(fecha_reserva)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Filtra reservas por rango inclusive en fecha_reserva. */
export function filtrarReservasPorFecha(reservas, fechaDesde, fechaHasta) {
  if (!fechaDesde && !fechaHasta) return reservas
  return reservas.filter((r) => {
    const d = parseReservaFechaISO(r.fecha_reserva)
    if (!d) return false
    if (fechaDesde && d < fechaDesde) return false
    if (fechaHasta && d > fechaHasta) return false
    return true
  })
}
