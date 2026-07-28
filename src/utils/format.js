export const formatUF = (value) =>
  value ? `UF ${Number(value).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` : '—'

export const formatCLP = (value) =>
  value ? `$${Number(value).toLocaleString('es-CL')}` : '—'

/**
 * Formatea una fecha para mostrar.
 *
 * Ojo con las fechas sin hora: `new Date('2026-05-15')` las interpreta como
 * medianoche UTC, y al formatear en hora de Chile (UTC-4) retrocede al dia
 * anterior — toda la tabla se veia corrida un dia. Por eso los `YYYY-MM-DD` se
 * construyen como fecha local. Los timestamps completos si son instantes
 * reales y se dejan tal cual.
 */
export const formatDate = (dateStr) => {
  if (!dateStr || dateStr === 'NaT') return '—'
  const soloFecha = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(dateStr)
  return isNaN(d) ? dateStr : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatPct = (value) =>
  value != null ? `${Number(value).toFixed(1)}%` : '—'

export const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
