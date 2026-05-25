import { Search, SlidersHorizontal, X } from 'lucide-react'
import styles from './Filters.module.css'
import { listMiembrosEquipoInterno } from '../utils/equipoComercialInterno'

const EQUIPO_INTERNO_TODOS = '__equipo_interno__'

export default function Filters({ filters, onChange, reservas }) {
  const miembrosInterno = listMiembrosEquipoInterno()
  const proyectos = [...new Set(reservas.map(r => r.proyecto))].sort()
  const tipologias = [...new Set(reservas.map(r => r.tipologia))].sort()
  const estados = [...new Set(reservas.map(r => r.estado))].sort()

  const hasFilters =
    filters.search ||
    filters.estado ||
    filters.proyecto ||
    filters.tipologia ||
    filters.tipo_entrega ||
    filters.equipoInterno

  const clear = () =>
    onChange({
      search: '',
      estado: '',
      proyecto: '',
      tipologia: '',
      tipo_entrega: '',
      equipoInterno: '',
    })

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.search}
          placeholder="Buscar cliente, broker, proyecto, RUT..."
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <div className={styles.selects}>
        <SlidersHorizontal size={15} className={styles.filterIcon} />
        <select className={styles.select} value={filters.estado} onChange={e => onChange({ ...filters, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={styles.select} value={filters.proyecto} onChange={e => onChange({ ...filters, proyecto: e.target.value })}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={styles.select} value={filters.tipologia} onChange={e => onChange({ ...filters, tipologia: e.target.value })}>
          <option value="">Todas las tipologías</option>
          {tipologias.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={styles.select} value={filters.tipo_entrega} onChange={e => onChange({ ...filters, tipo_entrega: e.target.value })}>
          <option value="">Tipo de entrega</option>
          <option value="inmediata">Inmediata</option>
          <option value="futura">Futura</option>
        </select>
        <select
          className={styles.select}
          value={filters.equipoInterno ?? ''}
          onChange={(e) => onChange({ ...filters, equipoInterno: e.target.value })}
        >
          <option value="">Equipo comercial interno</option>
          <option value={EQUIPO_INTERNO_TODOS}>Todo el equipo interno</option>
          {miembrosInterno.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className={styles.clearBtn} onClick={clear}>
            <X size={13} /> Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
