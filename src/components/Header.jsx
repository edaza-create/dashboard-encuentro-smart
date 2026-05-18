import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import styles from './Header.module.css'

export default function Header({
  lastUpdated,
  onRefresh,
  loading,
  isLive = false,
  eventName = 'Capital Open',
  eventTagline = 'Cyber Junio',
  logoText = 'CO',
}) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>{logoText}</div>
        <div>
          <h1 className={styles.title}>{eventName}</h1>
          <p className={styles.subtitle}>{eventTagline} · reservas</p>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.status}>
          {isLive ? (
            <>
              <Wifi size={14} className={styles.live} />
              <span className={styles.live}>En tiempo real</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className={styles.offline} />
              <span className={styles.offline}>Modo local</span>
            </>
          )}
        </div>
        {lastUpdated && (
          <span className={styles.updated}>
            Actualizado {lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? styles.spinning : ''} />
          Actualizar
        </button>
      </div>
    </header>
  )
}
