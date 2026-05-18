import { RefreshCw, Settings, Wifi, WifiOff } from 'lucide-react'
import LoginControls from '../LoginControls'
import styles from './MainHeader.module.css'

const TITLES = {
  Resumen: 'Resumen',
  Reservas: 'Reservas',
  Conteos: 'Conteos',
  'Competencia Capital Open Equipos': 'Competencia Capital Open Equipos',
  'Competencia Capital Open Individual': 'Competencia Capital Open Individual',
}

export default function MainHeader({
  tab,
  lastUpdated,
  onRefresh,
  loading,
  isLive,
}) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{TITLES[tab] ?? tab}</h1>
        <div className={styles.meta}>
          {isLive ? (
            <span className={styles.live}>
              <Wifi size={14} aria-hidden />
              En vivo
            </span>
          ) : (
            <span className={styles.offline}>
              <WifiOff size={14} aria-hidden />
              Local
            </span>
          )}
          {lastUpdated && (
            <span className={styles.time}>
              {lastUpdated.toLocaleString('es-CL', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <LoginControls />
        <button type="button" className={styles.iconBtn} onClick={onRefresh} disabled={loading} aria-label="Actualizar datos">
          <RefreshCw size={18} className={loading ? styles.spin : ''} />
        </button>
        <button type="button" className={styles.settingsBtn} aria-label="Ajustes (próximamente)" disabled>
          <Settings size={18} />
          Ajustes
        </button>
      </div>
    </header>
  )
}
