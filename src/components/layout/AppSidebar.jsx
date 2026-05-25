import { useState } from 'react'
import {
  LayoutDashboard,
  Table2,
  BarChart3,
  Bell,
  SlidersHorizontal,
  ChevronDown,
  Trophy,
  UserCircle2,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react'
import styles from './AppSidebar.module.css'

const NAV = [
  { id: 'Asistencia reuniones', label: 'Asistencia reuniones', icon: ClipboardList },
  { id: 'Competencia Capital Open Equipos', label: 'Competencia Capital Open Equipos', icon: Trophy },
  {
    id: 'Competencia Capital Open Individual',
    label: 'Competencia Capital Open Individual',
    icon: UserCircle2,
  },
  { id: 'Resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'Reservas', label: 'Reservas', icon: Table2 },
  { id: 'Conteos', label: 'Conteos', icon: BarChart3 },
]

export default function AppSidebar({ tab, onTab, workspaceName, workspaceTag, workspaceLogoUrl }) {
  const [navOpen, setNavOpen] = useState(false)

  const handleTab = (id) => {
    onTab(id)
    setNavOpen(false)
  }

  return (
    <aside className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.top}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setNavOpen((o) => !o)}
          aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button type="button" className={styles.workspace}>
          {workspaceLogoUrl ? (
            <span className={styles.wsAvatarFrame}>
              <img
                src={workspaceLogoUrl}
                alt=""
                className={styles.wsAvatarImg}
                width={40}
                height={40}
                decoding="async"
              />
            </span>
          ) : (
            <span className={styles.wsAvatar}>{workspaceTag.slice(0, 2).toUpperCase()}</span>
          )}
          <span className={styles.wsText}>
            <span className={styles.wsName}>{workspaceName}</span>
            <span className={styles.wsHint}>Espacio de trabajo</span>
          </span>
          <ChevronDown size={16} className={styles.wsChevron} aria-hidden />
        </button>
      </div>

      <div className={styles.sectionLabel}>General</div>
      <nav className={styles.nav}>
        <button type="button" className={styles.navItemMuted} disabled>
          <Bell size={18} strokeWidth={2} />
          <span>Notificaciones</span>
          <span className={styles.badge}>12</span>
        </button>
        <button type="button" className={styles.navItemMuted} disabled>
          <SlidersHorizontal size={18} strokeWidth={2} />
          <span>Preferencias</span>
        </button>
      </nav>

      <div className={styles.sectionLabel}>Dashboard</div>
      <nav className={`${styles.nav} ${navOpen ? styles.navOpen : ''}`}>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.navItem} ${tab === id ? styles.navItemActive : ''}`}
            onClick={() => handleTab(id)}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.user}>
        <div className={styles.userAvatar} aria-hidden>
          {workspaceTag.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.userMeta}>
          <div className={styles.userName}>Equipo comercial</div>
          <div className={styles.userEmail}>dashboard@encuentro.smart</div>
        </div>
      </div>
    </aside>
  )
}
