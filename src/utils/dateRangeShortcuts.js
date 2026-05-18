import { format, startOfMonth, endOfMonth, startOfYear, subDays } from 'date-fns'

/** Rangos relativos a `now` (fecha local) en YYYY-MM-DD para inputs type="date". */
export function getDateShortcutRanges(now = new Date()) {
  return {
    esteMes: {
      desde: format(startOfMonth(now), 'yyyy-MM-dd'),
      hasta: format(endOfMonth(now), 'yyyy-MM-dd'),
    },
    ultimos30: {
      desde: format(subDays(now, 29), 'yyyy-MM-dd'),
      hasta: format(now, 'yyyy-MM-dd'),
    },
    ytd: {
      desde: format(startOfYear(now), 'yyyy-MM-dd'),
      hasta: format(now, 'yyyy-MM-dd'),
    },
  }
}

/**
 * Identifica qué atajo coincide con el rango actual (o null si es manual / parcial).
 */
export function activeDateShortcutId(fechaDesde, fechaHasta, cyberDesde, cyberHasta, now = new Date()) {
  const d = fechaDesde || ''
  const h = fechaHasta || ''
  if (!d && !h) return 'todas'
  if (d === cyberDesde && h === cyberHasta) return 'cyber'
  const r = getDateShortcutRanges(now)
  if (d === r.esteMes.desde && h === r.esteMes.hasta) return 'esteMes'
  if (d === r.ultimos30.desde && h === r.ultimos30.hasta) return 'ultimos30'
  if (d === r.ytd.desde && h === r.ytd.hasta) return 'ytd'
  return null
}
