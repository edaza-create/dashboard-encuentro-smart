import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarRange, Inbox, Trophy, UserCircle2, UsersRound } from 'lucide-react'
import { capitalOpenConfig } from '../config/capitalOpen'
import { useCompetenciaTotales } from '../hooks/useCompetenciaTotales'
import styles from './CapitalOpenHero.module.css'

function fmtFecha(iso) {
  try {
    const a = parseISO(iso)
    if (!isValid(a)) return iso
    return format(a, "d MMM yyyy", { locale: es }).replace(/\./g, '')
  } catch {
    return iso
  }
}

export default function CapitalOpenHero({ reservas }) {
  const { nombre, subtitulo, cyberDesde, cyberHasta, logoUrl } = capitalOpenConfig
  const { reservas: n, puntosEquipos, puntosIndividual, puntosCompetencia } =
    useCompetenciaTotales(reservas)

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div>
          <div className={styles.brand}>
            <div className={styles.logoFrame}>
              <img
                src={logoUrl}
                alt="Capital Open"
                className={styles.logoImg}
                width={108}
                height={108}
                decoding="async"
              />
            </div>
            <div className={styles.brandBody}>
              <div className={styles.badge}>CYBER</div>
              <h2 className={styles.title}>{nombre}</h2>
              <p className={styles.sub}>{subtitulo} · ventana Cyber</p>
              <div className={styles.dates}>
                <CalendarRange size={15} className={styles.datesIcon} aria-hidden />
                <span>
                  Periodo de reserva: <strong>{fmtFecha(cyberDesde)}</strong> —{' '}
                  <strong>{fmtFecha(cyberHasta)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.statBlock}>
            <div className={styles.countRow}>
              <Inbox size={20} aria-hidden />
              <span className={styles.count}>{n.toLocaleString('es-CL')}</span>
            </div>
            <p className={styles.totalCaption}>Reservas en el periodo</p>
          </div>
          <div className={styles.pointsGrid}>
            <div className={styles.pointCard}>
              <UsersRound size={16} aria-hidden />
              <span className={styles.pointValue}>{puntosEquipos.toLocaleString('es-CL')}</span>
              <span className={styles.pointLabel}>Pts equipos</span>
            </div>
            <div className={styles.pointCard}>
              <UserCircle2 size={16} aria-hidden />
              <span className={styles.pointValue}>{puntosIndividual.toLocaleString('es-CL')}</span>
              <span className={styles.pointLabel}>Pts individual</span>
            </div>
          </div>
          <div className={styles.competenciaTotal}>
            <Trophy size={18} aria-hidden />
            <span>
              Total competencia: <strong>{puntosCompetencia.toLocaleString('es-CL')} pts</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
