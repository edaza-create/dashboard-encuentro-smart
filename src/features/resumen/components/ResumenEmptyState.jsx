import { Inbox } from 'lucide-react'
import styles from '../ResumenPage.module.css'

export default function ResumenEmptyState() {
  return (
    <section className={styles.emptyState} aria-label="Sin datos en resumen">
      <Inbox size={40} strokeWidth={1.5} className={styles.emptyStateIcon} aria-hidden />
      <h2 className={styles.emptyStateTitle}>No hay reservas en este periodo</h2>
      <p className={styles.emptyStateText}>
        No se encontraron reservas dentro de la ventana Cyber configurada. Revisa las fechas en{' '}
        <code>.env</code> o pulsa <strong>Actualizar</strong> en el encabezado si acabas de sincronizar la API.
      </p>
    </section>
  )
}
