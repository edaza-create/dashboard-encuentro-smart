import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarRange } from 'lucide-react'
import styles from './DateRangeFilter.module.css'
import { capitalOpenConfig } from '../config/capitalOpen'

function fmtFecha(iso) {
  try {
    const a = parseISO(iso)
    if (!isValid(a)) return iso
    return format(a, "d MMM yyyy", { locale: es }).replace(/\./g, '')
  } catch {
    return iso
  }
}

export default function DateRangeFilter({ total, filtradas }) {
  const { cyberDesde, cyberHasta } = capitalOpenConfig

  return (
    <div className={styles.wrap}>
      <div className={styles.labelRow}>
        <CalendarRange size={16} strokeWidth={2} />
        <span>Periodo de reserva Cyber</span>
      </div>
      <div className={styles.period}>
        <span className={styles.periodBadge}>CYBER</span>
        <span className={styles.periodDates}>
          <strong>{fmtFecha(cyberDesde)}</strong>
          <span className={styles.periodSep}>—</span>
          <strong>{fmtFecha(cyberHasta)}</strong>
        </span>
        <span className={styles.hint}>
          {filtradas.toLocaleString('es-CL')} de {total.toLocaleString('es-CL')} reservas en ventana
        </span>
      </div>
    </div>
  )
}
