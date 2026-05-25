import { useMemo } from 'react'
import { BookOpen, RotateCcw, Save, UserCircle2 } from 'lucide-react'
import CompetenciaRemoteSyncBanner from './CompetenciaRemoteSyncBanner'
import { useCompetenciaIndividualManual } from '../hooks/useCompetenciaIndividualManual'
import { useAuth } from '../context/AuthContext'
import {
  listAsesoresCompetenciaIndividual,
  puntosManualIndividual,
  totalIndividual,
} from '../utils/competenciaCapitalOpenIndividual'
import { compareRankingPorPuntosYUf } from '../utils/rankingCompare'
import { SCORING } from '../utils/competenciaCapitalOpenScore'
import { formatUF } from '../utils/format'
import styles from './CompetenciaCapitalOpenIndividualTab.module.css'

export default function CompetenciaCapitalOpenIndividualTab({ reservas = [] }) {
  const { canEditCompetencia, adminLockActive, session } = useAuth()
  const asesoresBase = useMemo(() => listAsesoresCompetenciaIndividual(reservas), [reservas])
  const asesorKeys = useMemo(() => asesoresBase.map((a) => a.key), [asesoresBase])

  const { saved, draft, patchDraft, saveAsesor, resetAll, hydrated, isDirty, remotePush } =
    useCompetenciaIndividualManual(asesorKeys)

  const rows = useMemo(() => {
    return [...asesoresBase]
      .map((a) => {
        const s = saved[a.key] || { promesasCount: 0, escriturasCount: 0 }
        const pm = puntosManualIndividual(s)
        const total = totalIndividual(s, a.reservas)
        return { ...a, total, pm }
      })
      .sort(compareRankingPorPuntosYUf)
  }, [asesoresBase, saved])

  const totales = useMemo(() => {
    const r = rows.reduce(
      (acc, row) => {
        acc.res += row.reservas
        acc.pr += row.pm.promesas
        acc.es += row.pm.escrituras
        acc.tot += row.total
        acc.uf += row.ufTotal
        return acc
      },
      { res: 0, pr: 0, es: 0, tot: 0, uf: 0 }
    )
    r.autoReserva = r.res * SCORING.reservaPorRegistro
    return r
  }, [rows])

  const handleReset = () => {
    if (!canEditCompetencia) return
    if (
      !window.confirm(
        '¿Borrar todas las promesas y escrituras guardadas por asesor? Las reservas automáticas no se modifican.'
      )
    ) {
      return
    }
    resetAll()
  }

  return (
    <div className={styles.wrap}>
      {adminLockActive && !canEditCompetencia && (
        <p className={styles.readOnlyBanner} role="status">
          {session?.user?.email
            ? 'Tu cuenta no tiene permiso de edición en competencia. Solo los correos administradores pueden guardar o reiniciar puntos.'
            : 'La edición de competencia está restringida. En el encabezado, solicita un enlace de acceso con un correo autorizado.'}
        </p>
      )}

      <CompetenciaRemoteSyncBanner
        canEdit={canEditCompetencia}
        hasSession={Boolean(session)}
        remotePush={remotePush}
      />

      <section className={styles.rulesCard} aria-labelledby="reglas-individual">
        <div className={styles.rulesHeader}>
          <BookOpen size={20} aria-hidden />
          <h2 id="reglas-individual" className={styles.rulesTitle}>
            Sistema de puntos — competencia individual
          </h2>
        </div>
        <ul className={styles.rulesBullets}>
          <li>
            <strong>Reserva:</strong> {SCORING.reservaPorRegistro} pts por reserva en ventana Cyber, solo si el
            registro está en un BP de la competencia. Se suma por asesor según los datos.
          </li>
          <li>
            <strong>Cartera UF:</strong> suma del valor UF de cada reserva del asesor (promesa; si no hay, venta),
            con el mismo criterio que el resto del dashboard.
          </li>
          <li>
            <strong>Promesa:</strong> {SCORING.promesaPorRegistro} pts por cada promesa registrada manualmente
            en el desglose del asesor. Se suman al equipo según el BP del asesor.
          </li>
          <li>
            <strong>Escritura:</strong> {SCORING.escrituraPorRegistro} pts por cada escritura registrada
            manualmente en el desglose del asesor. Se suman al equipo según el BP del asesor.
          </li>
        </ul>
        <p className={styles.rulesNote}>
          <strong>Asesor:</strong> se usa el campo <code>nombre_asesor</code> de la reserva cuando existe. Si no
          viene en datos, se agrupa por <code>user_email</code> del broker y, en último caso, por nivel
          jerárquico. Puedes mapear columnas en la plataforma a <code>nombre_asesor</code> vía PostgREST.
        </p>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.head}>
          <UserCircle2 size={22} className={styles.headIcon} aria-hidden />
          <div>
            <h2 className={styles.title}>Puntos por asesor</h2>
            <p className={styles.sub}>
              Desglose por persona. Edita promesas y escrituras y pulsa <strong>Guardar</strong> en cada asesor
              para fijar puntos.
            </p>
          </div>
        </div>
        <button type="button" className={styles.resetBtn} onClick={handleReset} disabled={!hydrated || !canEditCompetencia}>
          <RotateCcw size={16} aria-hidden />
          Reiniciar manual
        </button>
      </div>

      <div className={styles.summary}>
        <span>
          Asesores: <strong>{rows.length.toLocaleString('es-CL')}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Reservas competencia: <strong>{totales.res.toLocaleString('es-CL')}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Cartera UF: <strong>{formatUF(Math.round(totales.uf))}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Pts reserva: <strong>{totales.autoReserva.toLocaleString('es-CL')}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Pts promesas guardadas: <strong>{totales.pr.toLocaleString('es-CL')}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Pts escrituras guardadas: <strong>{totales.es.toLocaleString('es-CL')}</strong>
        </span>
        <span className={styles.summarySep}>·</span>
        <span>
          Total general: <strong>{totales.tot.toLocaleString('es-CL')}</strong> pts
        </span>
      </div>

      {rows.length === 0 && (
        <p className={styles.empty}>
          No hay reservas en la ventana actual con un BP mapeado a la competencia Capital Open.
        </p>
      )}

      <div className={styles.cards}>
        {rows.map((row) => {
          const d = draft[row.key] || { promesasCount: 0, escriturasCount: 0 }
          const s = saved[row.key] || { promesasCount: 0, escriturasCount: 0 }
          const pmSaved = puntosManualIndividual(s)
          const dirty = isDirty(row.key)

          return (
            <article key={row.key} className={styles.asCard}>
              <div className={styles.asHead}>
                <div>
                  <h3 className={styles.asName}>{row.etiqueta}</h3>
                  <div className={styles.asMeta}>
                    {row.email ? <span className={styles.asEmail}>{row.email}</span> : null}
                    <span className={styles.asBp}>Nivel: {row.nivelJerarquia}</span>
                    {row.equipoLabel ? (
                      <span className={styles.asEquipo}>Equipo: {row.equipoLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div className={styles.asTotalWrap}>
                  <span className={styles.asTotalLabel}>Total</span>
                  <span className={styles.asTotal}>{row.total.toLocaleString('es-CL')} pts</span>
                  <span className={styles.asUf} title="Suma UF de sus reservas en competencia">
                    {formatUF(Math.round(row.ufTotal))}
                  </span>
                </div>
              </div>

              
                
                  <span>Cartera UF ({row.reservas} reservas)</span>
                  <strong>{formatUF(Math.round(row.ufTotal))}</strong>
                
                <div className={styles.breakLine}>
                  <span>
                    Reservas ({row.reservas}) × {SCORING.reservaPorRegistro}
                  </span>
                  <strong>{row.puntosReserva.toLocaleString('es-CL')} pts</strong>
                
                <div className={styles.breakLine}>
                  <span>Promesas</span>
                  <strong>{pmSaved.promesas.toLocaleString('es-CL')} pts</strong>
                </div>
                <div className={styles.breakLine}>
                  <span>Escrituras</span>
                  <strong>{pmSaved.escrituras.toLocaleString('es-CL')} pts</strong>
                </div>
              </div>

              {dirty && (
                <p className={styles.draftHint} role="status">
                  Cambios sin guardar.
                </p>
              )}

              <div className={styles.manualForm}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Promesas · {SCORING.promesaPorRegistro} pts c/u</span>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    className={styles.inputNum}
                    value={d.promesasCount}
                    disabled={!canEditCompetencia}
                    onChange={(e) =>
                      patchDraft(row.key, {
                        promesasCount: Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)),
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Escrituras · {SCORING.escrituraPorRegistro} pts c/u</span>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    className={styles.inputNum}
                    value={d.escriturasCount}
                    disabled={!canEditCompetencia}
                    onChange={(e) =>
                      patchDraft(row.key, {
                        escriturasCount: Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => saveAsesor(row.key)}
                  disabled={!dirty || !canEditCompetencia}
                >
                  <Save size={16} aria-hidden />
                  Guardar
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
