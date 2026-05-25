import { AlertTriangle, X } from 'lucide-react'
import styles from '../AsistenciaAdminPage.module.css'

export default function QRGenerarConfirm({ reunion, onConfirm, onCancel, saving }) {
  const baseUrl = window.location.origin
  const url = `${baseUrl}/asistencia?reunion=${reunion.id}`

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Generar QR — {reunion.nombre}</h2>
          <button type="button" className={styles.modalClose} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.confirmWarning}>
            <AlertTriangle size={18} />
            <div>
              <p><strong>Una vez generado, el QR dura 35 minutos.</strong></p>
              <p>¿Estás seguro de que la reunión está por comenzar?</p>
            </div>
          </div>

          <div className={styles.confirmUrl}>
            <span className={styles.fieldLabel}>URL que recibirán los asesores:</span>
            <code className={styles.urlCode}>{url}</code>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.actionBtnMuted} onClick={onCancel}>Cancelar</button>
            <button type="button" className={styles.actionBtn} onClick={() => onConfirm(reunion)} disabled={saving}>
              {saving ? 'Generando...' : 'Confirmar y generar QR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
