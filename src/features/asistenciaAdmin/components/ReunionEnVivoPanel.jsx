import { X, RefreshCw } from 'lucide-react'
import { useCountdown } from '../../../hooks/useCountdown.js'
import { useReunionEnVivo } from '../../../hooks/useReunionEnVivo.js'
import { breakdownReunion } from '../../../utils/buildAsistenciaPuntos.js'
import { rosterEmailsPorEquipoCapitalOpen } from '../../../utils/asesorMaestra.js'
import { EQUIPOS_CAPITAL_ONE } from '../../../data/competenciaCapitalOneTeams.js'
import styles from './ReunionEnVivoPanel.module.css'

const rosterMap = rosterEmailsPorEquipoCapitalOpen()
const equipoLabel = Object.fromEntries(EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), e.label]))

export default function ReunionEnVivoPanel({ reunion, onClose }) {
  const countdown = useCountdown(reunion.closes_at)
  const { conteos, registros, totalAsistentes, refetch } = useReunionEnVivo(reunion.id, { includeRegistros: true })

  const breakdown = breakdownReunion(conteos, rosterMap)
  const totalPresencial = conteos.filter((c) => c.modalidad === 'Presencial').reduce((s, c) => s + Number(c.total), 0)
  const totalOnline = conteos.filter((c) => c.modalidad === 'Online').reduce((s, c) => s + Number(c.total), 0)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>En vivo — {reunion.nombre}</h2>
            <span className={styles.headerMeta}>
              Cierra en: {countdown.remaining}
            </span>
          </div>
          <div className={styles.headerRight}>
            <button type="button" className={styles.refreshBtn} onClick={refetch}>
              <RefreshCw size={14} />
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>{totalAsistentes}</span>
            <span className={styles.kpiLabel}>Asistentes</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>{totalPresencial}</span>
            <span className={styles.kpiLabel}>Presencial</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>{totalOnline}</span>
            <span className={styles.kpiLabel}>Online</span>
          </div>
        </div>

        <div className={styles.body}>
          <section>
            <h3 className={styles.sectionTitle}>Equipos</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Total</th>
                    <th>Presencial</th>
                    <th>Online</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((eq) => (
                      <tr key={eq.equipo_id} className={eq.ptsTotal > 0 ? styles.rowGreen : ''}>
                        <td className={styles.tdName}>{equipoLabel[eq.equipo_id] ?? eq.equipo_id}</td>
                        <td>{eq.online + eq.presencial}/{eq.rosterSize}</td>
                        <td>{eq.presencial} ({Math.round(eq.presencialPct * 100)}%)</td>
                        <td>{eq.online} ({Math.round(eq.onlinePct * 100)}%)</td>
                        <td>{eq.ptsTotal > 0 ? <span className={styles.ptsBadge}>+{eq.ptsTotal}</span> : '—'}</td>
                      </tr>
                  ))}
                  {breakdown.length === 0 && (
                    <tr><td colSpan={5} className={styles.emptyRow}>Sin registros aún</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {registros.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Asesores registrados ({registros.length})</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>BP</th>
                      <th>Equipo</th>
                      <th>Mod.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r) => (
                      <tr key={r.id}>
                        <td>{r.nombre ?? r.email}</td>
                        <td>{r.bp_slug ?? '—'}</td>
                        <td>{r.equipo_label ?? '—'}</td>
                        <td>{r.modalidad === 'Presencial' ? '🏢' : '🖥'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
