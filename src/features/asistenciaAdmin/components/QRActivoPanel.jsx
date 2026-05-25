import { useRef, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Printer, Download, Copy, Square, X } from 'lucide-react'
import { useCountdown } from '../../../hooks/useCountdown.js'
import { useReunionEnVivo } from '../../../hooks/useReunionEnVivo.js'
import { breakdownReunion } from '../../../utils/buildAsistenciaPuntos.js'
import { rosterEmailsPorEquipoCapitalOpen } from '../../../utils/asesorMaestra.js'
import { EQUIPOS_CAPITAL_ONE } from '../../../data/competenciaCapitalOneTeams.js'
import styles from './QRActivoPanel.module.css'

const rosterMap = rosterEmailsPorEquipoCapitalOpen()
const equipoLabel = Object.fromEntries(EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), e.label]))

export default function QRActivoPanel({ reunion, onClose, onCloseReunion }) {
  const qrRef = useRef(null)
  const url = `${window.location.origin}/asistencia?reunion=${reunion.id}`
  const countdown = useCountdown(reunion.closes_at)
  const { conteos, totalAsistentes } = useReunionEnVivo(reunion.id)

  const breakdown = breakdownReunion(conteos, rosterMap)
  const totalPresencial = conteos.filter((c) => c.modalidad === 'Presencial').reduce((s, c) => s + Number(c.total), 0)
  const totalOnline = conteos.filter((c) => c.modalidad === 'Online').reduce((s, c) => s + Number(c.total), 0)

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${reunion.nombre.replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [reunion.nombre])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url)
  }, [url])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>QR Activo — {reunion.nombre}</h2>
          <div className={styles.headerRight}>
            <span className={styles.countdown}>{countdown.remaining}</span>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={styles.countdownBar}>
          <div className={styles.countdownFill} style={{ width: `${countdown.progress * 100}%` }} />
        </div>

        <div className={styles.body}>
          <div className={styles.qrSection} ref={qrRef}>
            <QRCodeCanvas value={url} size={280} level="M" includeMargin />
            <div className={styles.qrActions}>
              <button type="button" className={styles.qrBtn} onClick={() => window.print()}>
                <Printer size={14} /> Imprimir
              </button>
              <button type="button" className={styles.qrBtn} onClick={handleDownload}>
                <Download size={14} /> PNG
              </button>
              <button type="button" className={styles.qrBtn} onClick={handleCopy}>
                <Copy size={14} /> URL
              </button>
            </div>
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Total asistentes</span>
              <span className={styles.statValue}>{totalAsistentes}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Presencial</span>
              <span className={styles.statValue}>{totalPresencial}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Online</span>
              <span className={styles.statValue}>{totalOnline}</span>
            </div>

            <h3 className={styles.equiposTitle}>Por equipo</h3>
            {breakdown.length === 0 && (
              <p className={styles.emptyHint}>Sin registros aún</p>
            )}
            {breakdown.map((eq) => (
              <div key={eq.equipo_id} className={`${styles.equipoRow} ${eq.ptsTotal > 0 ? styles.equipoRowGreen : ''}`}>
                <span className={styles.equipoName}>{equipoLabel[eq.equipo_id] ?? `Equipo ${eq.equipo_id}`}</span>
                <span className={styles.equipoCount}>
                  {eq.online + eq.presencial}/{eq.rosterSize}
                </span>
                {eq.ptsTotal > 0 && (
                  <span className={styles.ptsBadge}>+{eq.ptsTotal} pts</span>
                )}
              </div>
            ))}

            {onCloseReunion && (
              <button type="button" className={styles.closeMeetingBtn} onClick={() => onCloseReunion(reunion)}>
                <Square size={14} /> Cerrar reunión ahora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
