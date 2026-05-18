import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarRange, Inbox } from 'lucide-react'
import { capitalOpenConfig, reservasEnVentanaCyber } from '../config/capitalOpen'
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
  const enCyber = reservasEnVentanaCyber(reservas)
  const n = enCyber.length

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
                  Periodo de reserva: <strong>{fmtFecha(cyberDesde)}</strong> — <strong>{fmtFecha(cyberHasta)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.countRow}>
            <Inbox size={22} style={{ opacity: 0.9, marginRight: 4 }} aria-hidden />
            <span className={styles.count}>{n.toLocaleString('es-CL')}</span>
          </div>
          <p className={styles.totalCaption}>Reservas totales en el periodo</p>
        </div>
      </div>
    </div>
  )
}
