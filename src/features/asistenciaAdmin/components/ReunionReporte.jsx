import { useState, useEffect } from 'react'
import { X, RotateCcw, Archive } from 'lucide-react'
import { fetchRegistrosPorReunion, fetchConteosPorReunion } from '../../../api/asistenciaRegistros.js'
import { breakdownReunion } from '../../../utils/buildAsistenciaPuntos.js'
import { detectarAusentes } from '../../../utils/ausentes.js'
import { rosterEmailsPorEquipoCapitalOpen } from '../../../utils/asesorMaestra.js'
import { EQUIPOS_CAPITAL_ONE } from '../../../data/competenciaCapitalOneTeams.js'
import ExportarCSVButton from './ExportarCSVButton.jsx'
import styles from './ReunionReporte.module.css'

const rosterMap = rosterEmailsPorEquipoCapitalOpen()
const equipoLabel = Object.fromEntries(EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), e.label]))

export default function ReunionReporte({ reunion, onClose, onReopen, onArchive }) {
  const [registros, setRegistros] = useState([])
  const [conteos, setConteos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetchRegistrosPorReunion(reunion.id, ac.signal),
      fetchConteosPorReunion(reunion.id, ac.signal),
    ]).then(([r, c]) => {
      setRegistros(r)
      setConteos(c)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => ac.abort()
  }, [reunion.id])

  const breakdown = breakdownReunion(conteos, rosterMap)
  const totalPresencial = conteos.filter((c) => c.modalidad === 'Presencial').reduce((s, c) => s + Number(c.total), 0)
  const totalOnline = conteos.filter((c) => c.modalidad === 'Online').reduce((s, c) => s + Number(c.total), 0)
  const totalPts = breakdown.reduce((s, eq) => s + eq.ptsTotal, 0)
  const ausentes = detectarAusentes(registros)

  const fecha = reunion.fecha_evento
    ? new Date(reunion.fecha_evento + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  if (loading) {
    return (
      <div className={styles.overlay}><div className={styles.panel}><p className={styles.loading}>Cargando reporte...</p></div></div>
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Reporte — {reunion.nombre}</h2>
            {fecha && <span className={styles.headerMeta}>{fecha}</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.kpiRow}>
          <div className={styles.kpi}><span className={styles.kpiValue}>{registros.length}</span><span className={styles.kpiLabel}>Asistentes</span></div>
          <div className={styles.kpi}><span className={styles.kpiValue}>{totalPresencial}</span><span className={styles.kpiLabel}>Presencial</span></div>
          <div className={styles.kpi}><span className={styles.kpiValue}>{totalOnline}</span><span className={styles.kpiLabel}>Online</span></div>
          <div className={styles.kpi}><span className={styles.kpiValue}>{totalPts}</span><span className={styles.kpiLabel}>Pts otorgados</span></div>
        </div>

        <div className={styles.body}>
          <section>
            <h3 className={styles.sectionTitle}>Puntos por equipo</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Equipo</th><th>Total</th><th>Presencial</th><th>Online</th><th>Puntos</th></tr>
                </thead>
                <tbody>
                  {breakdown.map((eq) => (
                    <tr key={eq.equipo_id} className={eq.ptsTotal > 0 ? styles.rowGreen : ''}>
                      <td className={styles.tdName}>
                        {eq.ptsTotal > 0 ? '✅ ' : '❌ '}{equipoLabel[eq.equipo_id] ?? eq.equipo_id}
                      </td>
                      <td>{eq.online + eq.presencial}/{eq.rosterSize}</td>
                      <td>{eq.presencial} ({Math.round(eq.presencialPct * 100)}%)</td>
                      <td>{eq.online} ({Math.round(eq.onlinePct * 100)}%)</td>
                      <td>{eq.ptsTotal > 0 ? <span className={styles.ptsBadge}>+{eq.ptsTotal}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className={styles.sectionTitle}>Asistentes ({registros.length})</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Nombre</th><th>BP</th><th>Equipo</th><th>Modalidad</th><th>Hora</th></tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre ?? r.email}</td>
                      <td>{r.bp_slug ?? '—'}</td>
                      <td>{r.equipo_label ?? '—'}</td>
                      <td>{r.modalidad}</td>
                      <td className={styles.tdMono}>{new Date(r.registrado_en).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {ausentes.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Ausentes detectados ({ausentes.length})</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Nombre</th><th>BP</th><th>Equipo</th></tr>
                  </thead>
                  <tbody>
                    {ausentes.map((a) => (
                      <tr key={a.email}>
                        <td>{a.nombre ?? a.email}</td>
                        <td>{a.subgrupo}</td>
                        <td>{a.equipo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className={styles.reportActions}>
            <ExportarCSVButton registros={registros} filename={`asistencia-${reunion.nombre.replace(/\s+/g, '-')}`} />
            {onReopen && (
              <button type="button" className={styles.actionBtnMuted} onClick={() => onReopen(reunion)}>
                <RotateCcw size={14} /> Reabrir reunión
              </button>
            )}
            {onArchive && (
              <button type="button" className={styles.actionBtnMuted} onClick={() => { onArchive(reunion); onClose() }}>
                <Archive size={14} /> Archivar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
