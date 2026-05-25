import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarRange, Info } from 'lucide-react'
import { capitalOpenConfig } from '../../../config/capitalOpen.js'
import styles from '../ResumenPage.module.css'

function fmtFecha(iso) {
  try {
    const a = parseISO(iso)
    if (!isValid(a)) return iso
    return format(a, 'd MMM yyyy', { locale: es }).replace(/\./g, '')
  } catch {
    return iso
  }
}

export default function ResumenContextBar({ filtradas, totalApi, lastUpdated }) {
  const { cyberDesde, cyberHasta } = capitalOpenConfig
  const fueraDeVentana = totalApi > filtradas

  return (
    <div
      className={styles.contextBar}
      role="status"
      aria-label="Contexto de datos del resumen"
    >
      <div className={styles.contextMain}>
        <CalendarRange size={18} className={styles.contextIcon} aria-hidden />
        <div>
          <span className={styles.contextTitle}>Ventana Capital Open Cyber</span>
          <span className={styles.contextDates}>
            <strong>{fmtFecha(cyberDesde)}</strong>
            <span className={styles.contextSep}>—</span>
            <strong>{fmtFecha(cyberHasta)}</strong>
          </span>
        </div>
      </div>
      <div className={styles.contextMeta}>
        <span className={styles.contextCount}>
          <strong>{filtradas.toLocaleString('es-CL')}</strong> reservas en resumen
        </span>
        {fueraDeVentana ? (
          <span className={styles.contextHint}>
            ({totalApi.toLocaleString('es-CL')} en API · {totalApi - filtradas} fuera de ventana)
          </span>
        ) : null}
        {lastUpdated ? (
          <span className={styles.contextUpdated}>
            Actualizado{' '}
            {lastUpdated.toLocaleString('es-CL', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
      </div>
      <p className={styles.contextNote}>
        <Info size={14} aria-hidden />
        Los filtros de estado/proyecto de otras pestañas no aplican aquí. Usa <strong>Reservas</strong> o{' '}
        <strong>Conteos</strong> para análisis filtrado.
      </p>
    </div>
  )
}
