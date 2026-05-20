import { useMemo } from 'react'
import { BookOpen, RotateCcw, Save, UsersRound } from 'lucide-react'
import {
  EQUIPOS_CAPITAL_ONE,
  etiquetaBrokerPlataforma,
  cuentaReservasBroker,
} from '../data/competenciaCapitalOneTeams'
import { brokerTieneMapeo } from '../utils/brokerReservaMatch'
import CompetenciaRemoteSyncBanner from './CompetenciaRemoteSyncBanner'
import { useCompetenciaManualPoints } from '../hooks/useCompetenciaManualPoints'
import { useIndividualManualSaved } from '../hooks/useIndividualManualSaved'
import { useAuth } from '../context/AuthContext'
import { aggregateManualIndividualPorEquipo } from '../utils/competenciaIndividualToEquipo'
import {
  SCORING,
  cuentaReservasEquipo,
  equiposOrdenadosPorPuntos,
  manualEfectivoEquipo,
  puntosManualEquipo,
  puntosReservaAuto,
  totalPuntosEquipo,
} from '../utils/competenciaCapitalOpenScore'
import styles from './CompetenciaCapitalOneTab.module.css'

export default function CompetenciaCapitalOneTab({ reservas = [] }) {
  const { canEditCompetencia, adminLockActive, session } = useAuth()
  const { savedTeams, draftTeams, patchDraft, saveTeam, resetManual, hydrated, isTeamDirty, remotePush } =
    useCompetenciaManualPoints()
  const indManual = useIndividualManualSaved()

  const indPorEquipo = useMemo(
    () => aggregateManualIndividualPorEquipo(reservas, indManual),
    [reservas, indManual]
  )

  const ranking = useMemo(
    () => equiposOrdenadosPorPuntos(reservas, savedTeams, indManual),
    [reservas, savedTeams, indManual]
  )

  const handleResetManual = () => {
    if (!canEditCompetencia) return
    if (
      !window.confirm(
        '¿Reiniciar las actividades guardadas de todos los equipos? Las reservas y las promesas/escrituras de asesores no se modifican.'
      )
    ) {
      return
    }
    resetManual()
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

      <section className={styles.rulesCard} aria-labelledby="reglas-puntos-titulo">
        <div className={styles.rulesHeader}>
          <BookOpen size={22} strokeWidth={2} aria-hidden />
          <h2 id="reglas-puntos-titulo" className={styles.rulesTitle}>
            Cómo funcionan los puntos
          </h2>
        </div>
        <p className={styles.rulesLead}>
          Cada ítem suma los puntos indicados. Las reservas se calculan con los datos de la ventana Cyber. Las
          actividades: marca la casilla del evento y pulsa <strong>Guardar</strong> para sumar +15 pts; la
          casilla se limpia y puedes volver a registrar otro evento cuando corresponda.
        </p>
        <div className={styles.rulesGrid}>
          <div className={styles.rulesBlock}>
            <h3 className={styles.rulesBlockTitle}>Puntos</h3>
            <ul className={styles.rulesList}>
              <li>
                <strong>Reserva:</strong> {SCORING.reservaPorRegistro} pts
              </li>
              <li>
                <strong>Promesa:</strong> {SCORING.promesaPorRegistro} pts
              </li>
              <li>
                <strong>Escritura:</strong> {SCORING.escrituraPorRegistro} pts
              </li>
            </ul>
          </div>
          <div className={styles.rulesBlock}>
            <h3 className={styles.rulesBlockTitle}>Actividades</h3>
            <ul className={styles.rulesList}>
              <li>
                <strong>Online:</strong> +{SCORING.actividadOnline} pts por evento cumplido ≥80% asistencia — se
                suma al guardar con la casilla marcada; acumulable.
              </li>
              <li>
                <strong>Presencial:</strong> +{SCORING.actividadPresencial} pts por evento ≥50% asistencia — se
                suma al guardar con la casilla marcada; acumulable.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.scoringSection} aria-labelledby="puntuacion-titulo">
        <div className={styles.sectionHead}>
          <h2 id="puntuacion-titulo" className={styles.sectionTitle}>
            Puntuación por equipo
          </h2>
          <button type="button" className={styles.resetBtn} onClick={handleResetManual} disabled={!hydrated || !canEditCompetencia}>
            <RotateCcw size={16} aria-hidden />
            Reiniciar guardado
          </button>
        </div>
        <p className={styles.intro}>
          Las <strong>promesas</strong> y <strong>escrituras</strong> se suman automáticamente desde la competencia
          individual (cada asesor se asigna al equipo según su BP). Aquí solo registras{' '}
          <strong>actividades</strong> del equipo y pulsas <strong>Guardar</strong>.
        </p>
        <div className={styles.scoreGrid}>
          {ranking.map(({ equipo, total }, index) => {
            const id = String(equipo.id)
            const saved = savedTeams[id] || defaultSavedFallback()
            const draft = draftTeams[id] || defaultDraftFallback()
            const fromInd = indPorEquipo[id] || { promesasCount: 0, escriturasCount: 0 }
            const efectivo = manualEfectivoEquipo(reservas, equipo, saved, indManual)
            const nRes = cuentaReservasEquipo(reservas, equipo)
            const ptsRes = puntosReservaAuto(reservas, equipo)
            const pm = puntosManualEquipo(efectivo)
            const ptsOnline = (saved.actividadOnlineCount || 0) * SCORING.actividadOnline
            const ptsPres = (saved.actividadPresencialCount || 0) * SCORING.actividadPresencial
            const rank = index + 1
            const dirty = isTeamDirty(equipo.id)
            const teamBg = equipo.backgroundImage

            return (
              <div
                key={id}
                className={`${styles.scoreCard} ${teamBg ? styles.scoreCardWithBg : ''}`}
                data-team-id={id}
              >
                {teamBg ? (
                  <div
                    className={styles.scoreCardBg}
                    style={{ backgroundImage: `url(${teamBg})` }}
                    aria-hidden
                  />
                ) : null}
                <div className={styles.scoreCardOverlay} aria-hidden />
                <div className={styles.scoreCardContent}>
                <div className={styles.scoreCardTop}>
                  <span className={styles.rankBadge} aria-label={`Puesto ${rank}`}>
                    {rank === 1 ? '1°' : rank === 2 ? '2°' : rank === 3 ? '3°' : `${rank}°`}
                  </span>
                  <div className={styles.scoreCardTitles}>
                    <h3 className={styles.scoreEquipoName}>{equipo.label}</h3>
                    <div className={styles.scoreTotalLine}>
                      Total <strong className={styles.scoreTotal}>{total.toLocaleString('es-CL')}</strong> pts
                    </div>
                  </div>
                </div>

                {dirty && (
                  <p className={styles.draftHint} role="status">
                    Cambios sin guardar: no suman al total hasta pulsar Guardar.
                  </p>
                )}

                <div className={styles.breakdown}>
                  <div className={styles.breakLine}>
                    <span>Reservas ({nRes}) × {SCORING.reservaPorRegistro}</span>
                    <strong>{ptsRes.toLocaleString('es-CL')} pts</strong>
                  </div>
                  <div className={styles.breakLine}>
                    <span>
                      Promesas ({fromInd.promesasCount} desde asesores) × {SCORING.promesaPorRegistro}
                    </span>
                    <strong>{pm.promesas.toLocaleString('es-CL')} pts</strong>
                  </div>
                  <div className={styles.breakLine}>
                    <span>
                      Escrituras ({fromInd.escriturasCount} desde asesores) × {SCORING.escrituraPorRegistro}
                    </span>
                    <strong>{pm.escrituras.toLocaleString('es-CL')} pts</strong>
                  </div>
                  <div className={styles.breakLine}>
                    <span>
                      Actividad online ({saved.actividadOnlineCount || 0}) × {SCORING.actividadOnline}
                    </span>
                    <strong>{ptsOnline.toLocaleString('es-CL')} pts</strong>
                  </div>
                  <div className={styles.breakLine}>
                    <span>
                      Actividad presencial ({saved.actividadPresencialCount || 0}) ×{' '}
                      {SCORING.actividadPresencial}
                    </span>
                    <strong>{ptsPres.toLocaleString('es-CL')} pts</strong>
                  </div>
                </div>

                <div className={styles.manualForm}>
                  <p className={styles.indRollupNote}>
                    Promesas y escrituras: {fromInd.promesasCount} / {fromInd.escriturasCount} registros
                    sumados desde competencia individual.
                  </p>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={draft.registrarOnline}
                      disabled={!canEditCompetencia}
                      onChange={(e) => patchDraft(equipo.id, { registrarOnline: e.target.checked })}
                    />
                    <span>
                      Sumar 1 evento online ≥80% asistencia · +{SCORING.actividadOnline} pts al guardar
                    </span>
                  </label>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={draft.registrarPresencial}
                      disabled={!canEditCompetencia}
                      onChange={(e) => patchDraft(equipo.id, { registrarPresencial: e.target.checked })}
                    />
                    <span>
                      Sumar 1 evento presencial ≥50% asistencia · +{SCORING.actividadPresencial} pts al guardar
                    </span>
                  </label>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={() => saveTeam(equipo.id)}
                    disabled={!dirty || !canEditCompetencia}
                  >
                    <Save size={16} aria-hidden />
                    Guardar
                  </button>
                </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <h2 className={styles.sectionTitle}>Equipos y brokers (BP)</h2>
      <p className={styles.intro}>
        Brokers/BP agrupados por equipo, mostrando el nombre original registrado en{' '}
        <strong>nivel jerárquico</strong> de las reservas. El conteo corresponde al periodo Cyber activo
        (mismo filtro de fechas que el resto del dashboard).
      </p>
      <div className={styles.grid}>
        {EQUIPOS_CAPITAL_ONE.map((equipo) => (
          <section key={equipo.id} className={styles.card} aria-labelledby={`equipo-title-${equipo.id}`}>
            <h2 id={`equipo-title-${equipo.id}`} className={styles.cardHead}>
              <UsersRound size={18} strokeWidth={2} aria-hidden />
              {equipo.label}
              <span className={styles.equipoPtsHint} title="Puntos totales del equipo">
                {totalPuntosEquipo(reservas, equipo, savedTeams[String(equipo.id)], indManual).toLocaleString(
                  'es-CL'
                )}{' '}
                pts
              </span>
            </h2>
            <ul className={styles.list}>
              {equipo.brokers.map((broker) => {
                const tienePlataforma = brokerTieneMapeo(broker)
                const principal = etiquetaBrokerPlataforma(broker)
                const extraNombres =
                  broker.nombresPlataforma?.length > 1 ? broker.nombresPlataforma.slice(1) : []
                const n = cuentaReservasBroker(reservas, broker)

                return (
                  <li key={`${equipo.id}-${broker.referenciaLista}`} className={styles.item}>
                    <div className={styles.itemMain}>
                      <span className={tienePlataforma ? styles.nombrePlataforma : styles.nombrePendiente}>
                        {principal}
                      </span>
                      {tienePlataforma && (
                        <span className={styles.count} title="Reservas en ventana">
                          {n}
                        </span>
                      )}
                    </div>
                    {extraNombres.length > 0 && (
                      <div className={styles.sinonimos}>
                        También agrupa: {extraNombres.join(' · ')}
                      </div>
                    )}
                    {!tienePlataforma && (
                      <div className={styles.sinCoincidencia}>
                        Lista competencia: «{broker.referenciaLista}» — sin mapeo en plataforma ni en planilla
                        Mayo; revisar nombre o email del asesor.
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function defaultSavedFallback() {
  return {
    promesasCount: 0,
    escriturasCount: 0,
    actividadOnlineCount: 0,
    actividadPresencialCount: 0,
  }
}

function defaultDraftFallback() {
  return {
    promesasCount: 0,
    escriturasCount: 0,
    registrarOnline: false,
    registrarPresencial: false,
  }
}
