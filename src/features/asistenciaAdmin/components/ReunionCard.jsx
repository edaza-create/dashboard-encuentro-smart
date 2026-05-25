import { Clock, QrCode, Play, Square, Archive, ArchiveRestore, Trash2, Eye, RotateCcw, FileText } from 'lucide-react'
import { useCountdown } from '../../../hooks/useCountdown.js'
import { useReunionEnVivo } from '../../../hooks/useReunionEnVivo.js'
import styles from '../AsistenciaAdminPage.module.css'

const TIPO_LABEL = {
  general: 'General',
  kickoff: 'Kick-off',
  cierre: 'Cierre',
  semanal: 'Semanal',
  especial: 'Especial',
}

const ESTADO_COLOR = {
  activa: styles.badgeGreen,
  borrador: styles.badgeGray,
  cerrada: styles.badgeRed,
  archivada: styles.badgeBlue,
}

export default function ReunionCard({ reunion, onGenerateQR, onClose, onArchive, onUnarchive, onDelete, onEdit, onViewQR, onViewLive, onViewReport, onReopen }) {
  const { estado } = reunion
  const countdown = useCountdown(estado === 'activa' ? reunion.closes_at : null)
  const { totalAsistentes } = useReunionEnVivo(estado === 'activa' ? reunion.id : null)

  const fecha = reunion.fecha_evento
    ? new Date(reunion.fecha_evento + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className={`${styles.reunionCard} ${estado === 'activa' ? styles.reunionCardActiva : ''}`}>
      <div className={styles.reunionCardTop}>
        <span className={`${styles.badge} ${ESTADO_COLOR[estado] || ''}`}>
          {estado}
        </span>
        {reunion.tipo && reunion.tipo !== 'general' && (
          <span className={styles.tipoBadge}>{TIPO_LABEL[reunion.tipo] || reunion.tipo}</span>
        )}
        {fecha && <span className={styles.fecha}>{fecha}</span>}
      </div>

      <h3 className={styles.reunionName}>{reunion.nombre}</h3>
      {reunion.descripcion && <p className={styles.reunionDesc}>{reunion.descripcion}</p>}

      {estado === 'activa' && (
        <div className={styles.liveInfo}>
          <div className={styles.countdownBar}>
            <div className={styles.countdownFill} style={{ width: `${countdown.progress * 100}%` }} />
          </div>
          <div className={styles.liveRow}>
            <span className={styles.liveDot} />
            <span>QR expira en <strong>{countdown.remaining}</strong></span>
            <span className={styles.asistCount}>{totalAsistentes} asistentes</span>
          </div>
        </div>
      )}

      {estado === 'cerrada' && (
        <p className={styles.closedHint}>Reunión cerrada</p>
      )}

      <div className={styles.actions}>
        {estado === 'borrador' && (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => onGenerateQR(reunion)}>
              <QrCode size={14} /> Generar QR
            </button>
            <button type="button" className={styles.actionBtnMuted} onClick={() => onEdit(reunion)}>
              Editar
            </button>
            <button type="button" className={styles.actionBtnDanger} onClick={() => onDelete(reunion)}>
              <Trash2 size={13} />
            </button>
          </>
        )}
        {estado === 'activa' && (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => onViewQR(reunion)}>
              <QrCode size={14} /> Ver QR
            </button>
            <button type="button" className={styles.actionBtn} onClick={() => onViewLive(reunion)}>
              <Eye size={14} /> En vivo
            </button>
            <button type="button" className={styles.actionBtnDanger} onClick={() => onClose(reunion)}>
              <Square size={14} /> Cerrar
            </button>
          </>
        )}
        {estado === 'cerrada' && (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => onViewReport(reunion)}>
              <FileText size={14} /> Reporte
            </button>
            <button type="button" className={styles.actionBtnMuted} onClick={() => onReopen(reunion)}>
              <RotateCcw size={14} /> Reabrir
            </button>
            <button type="button" className={styles.actionBtnMuted} onClick={() => onArchive(reunion)}>
              <Archive size={14} /> Archivar
            </button>
          </>
        )}
        {estado === 'archivada' && (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => onViewReport(reunion)}>
              <FileText size={14} /> Reporte
            </button>
            <button type="button" className={styles.actionBtnMuted} onClick={() => onUnarchive(reunion)}>
              <ArchiveRestore size={14} /> Desarchivar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
