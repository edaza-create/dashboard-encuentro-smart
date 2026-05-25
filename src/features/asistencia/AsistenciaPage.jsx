import { useMemo } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { useAsistenciaReuniones } from '../../hooks/useAsistenciaReuniones.js'
import { EQUIPOS_CAPITAL_ONE } from '../../data/competenciaCapitalOneTeams.js'
import { THRESHOLD_ONLINE, THRESHOLD_PRESENCIAL } from '../../utils/asistenciaActividades.js'
import { SCORING } from '../../utils/competenciaCapitalOpenScore.js'
import styles from './AsistenciaPage.module.css'

const equipoLabel = Object.fromEntries(
  EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), e.label])
)

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Math.round(Number(n) * 100)}%`
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AsistenciaPage() {
  const { status, error, rows, awards, enabled, refetch, lastSync } = useAsistenciaReuniones()

  const reuniones = useMemo(() => {
    const set = new Set(rows.map((r) => r.reunion).filter(Boolean))
    return [...set].sort()
  }, [rows])

  const resumenReunion = useMemo(() => {
    return reuniones.map((reunion) => {
      const delEquipo = rows.filter((r) => r.reunion === reunion)
      const premios = awards.filter((a) => a.reunion === reunion)
      return { reunion, asistencias: delEquipo.length, premios }
    })
  }, [reuniones, rows, awards])

  if (!enabled) {
    return (
      <div className={styles.wrap}>
        <p className={styles.warn}>
          Configura <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> en el{' '}
          <code>.env</code> y ejecuta el SQL en{' '}
          <code>docs/supabase-asistencia-reunion.sql</code>.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>
            <ClipboardList size={22} aria-hidden />
            Asistencia reuniones (Google Forms)
          </h1>
          <p className={styles.lede}>
            Cada respuesta del formulario suma al % del <strong>equipo Capital Open</strong>. Si se
            cumple ≥{Math.round(THRESHOLD_ONLINE * 100)}% online o ≥{Math.round(THRESHOLD_PRESENCIAL * 100)}%
            presencial, el equipo recibe +{SCORING.actividadOnline} pts automáticamente (visible en
            Competencia Equipos y <code>/cyber</code>).
          </p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={refetch} disabled={status === 'loading'}>
          <RefreshCw size={16} aria-hidden />
          Actualizar
        </button>
      </header>

      {status === 'loading' && <p className={styles.muted}>Cargando asistencias…</p>}
      {status === 'error' && (
        <p className={styles.error}>
          {error}. ¿Ejecutaste el SQL y desplegaste la Edge Function{' '}
          <code>forms-asistencia</code>?
        </p>
      )}

      {status === 'ready' && (
        <>
          {lastSync ? (
            <p className={styles.meta}>
              Última sync: {fmtDate(new Date(lastSync).toISOString())} · {rows.length} registro
              {rows.length === 1 ? '' : 's'}
            </p>
          ) : null}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Premios de actividad otorgados</h2>
            {awards.length === 0 ? (
              <p className={styles.muted}>Aún no hay premios automáticos (umbrales no alcanzados).</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Reunión</th>
                      <th>Equipo</th>
                      <th>Tipo</th>
                      <th>% online</th>
                      <th>% presencial</th>
                      <th>Roster</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awards.map((a) => (
                      <tr key={`${a.reunion}-${a.equipo_id}-${a.actividad_tipo}`}>
                        <td>{a.reunion}</td>
                        <td>{equipoLabel[a.equipo_id] ?? a.equipo_id}</td>
                        <td>{a.actividad_tipo}</td>
                        <td>{fmtPct(a.online_pct)}</td>
                        <td>{fmtPct(a.presencial_pct)}</td>
                        <td>{a.roster_total}</td>
                        <td>{fmtDate(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Resumen por reunión</h2>
            <ul className={styles.reunionList}>
              {resumenReunion.map((r) => (
                <li key={r.reunion}>
                  <strong>{r.reunion}</strong> — {r.asistencias} asistencia
                  {r.asistencias === 1 ? '' : 's'}, {r.premios.length} premio
                  {r.premios.length === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Registros recientes</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reunión</th>
                    <th>Asesor</th>
                    <th>Email</th>
                    <th>Subgrupo (BP)</th>
                    <th>Equipo</th>
                    <th>Modalidad</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.id}>
                      <td>{r.reunion}</td>
                      <td>{r.nombre ?? '—'}</td>
                      <td className={styles.mono}>{r.email}</td>
                      <td>{r.subgrupo ?? '—'}</td>
                      <td>{r.equipo ?? '—'}</td>
                      <td>{r.modalidad}</td>
                      <td>{fmtDate(r.registrado_en ?? r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 ? (
              <p className={styles.muted}>Mostrando los 100 más recientes.</p>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
