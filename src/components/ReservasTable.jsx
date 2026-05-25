import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, ArrowUpDown } from 'lucide-react'
import styles from './ReservasTable.module.css'
import { formatUF, formatCLP, formatDate, getInitials } from '../utils/format'
import ReservaModal from './ReservaModal'
import { useMediaQuery } from '../hooks/useMediaQuery'

const STATUS_COLORS = {
  Pendiente: 'warning',
  Aprobado: 'accent',
  Cancelado: 'danger',
}

const SORT_OPTIONS = [
  { key: 'fecha_reserva', label: 'Fecha' },
  { key: 'nombre_cliente', label: 'Cliente' },
  { key: 'proyecto', label: 'Proyecto' },
  { key: 'valor_promesa_uf', label: 'Valor UF' },
  { key: 'estado', label: 'Estado' },
  { key: 'nivel_jerarquia_nombre', label: 'Broker/BP' },
]

export default function ReservasTable({ reservas }) {
  const [sort, setSort] = useState({ key: 'fecha_reserva', dir: 'desc' })
  const [selected, setSelected] = useState(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const sorted = [...reservas].sort((a, b) => {
    const va = a[sort.key] ?? ''
    const vb = b[sort.key] ?? ''
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ col }) => {
    if (sort.key !== col) return <ArrowUpDown size={12} className={styles.sortIdle} />
    return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  const Th = ({ label, col }) => (
    <th className={styles.th} onClick={() => toggleSort(col)}>
      <span className={styles.thInner}>{label}<SortIcon col={col} /></span>
    </th>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Reservas ({reservas.length})</h3>
        {isMobile && (
          <select
            className={styles.sortSelect}
            value={sort.key}
            onChange={(e) => setSort(s => ({ key: e.target.value, dir: s.key === e.target.value && s.dir === 'desc' ? 'asc' : 'desc' }))}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>
                Ordenar: {o.label} {sort.key === o.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {isMobile ? (
        <div className={styles.mobileCards}>
          {sorted.map(r => (
            <button key={r.id} type="button" className={styles.mobileCard} onClick={() => setSelected(r)}>
              <div className={styles.mobileCardTop}>
                <div className={styles.avatar}>{getInitials(r.nombre_cliente)}</div>
                <div className={styles.mobileCardIdentity}>
                  <span className={styles.mobileCardName}>{r.nombre_cliente}</span>
                  <span className={styles.mobileCardSub}>{r.cliente_rut}</span>
                </div>
                <span className={`${styles.badge} ${styles[STATUS_COLORS[r.estado] || 'primary']}`}>
                  {r.revertida ? 'Revertida' : r.estado}
                </span>
              </div>
              <div className={styles.mobileCardBody}>
                <div className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>Fecha</span>
                  <span className={styles.mobileValue}>{formatDate(r.fecha_reserva)}</span>
                </div>
                <div className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>Proyecto</span>
                  <span className={styles.mobileValue}>{r.proyecto}</span>
                </div>
                <div className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>Valor UF</span>
                  <span className={styles.mobileValue}>{formatUF(r.valor_promesa_uf)}</span>
                </div>
                <div className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>Broker/BP</span>
                  <span className={styles.mobileValue}>
                    {r.miembro_equipo_interno
                      ? `${r.nivel_jerarquia_nombre} · ${r.miembro_equipo_interno}`
                      : r.nivel_jerarquia_nombre}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {reservas.length === 0 && (
            <div className={styles.empty}>No se encontraron reservas con los filtros aplicados.</div>
          )}
        </div>
      ) : (
        <div className={styles.scrollWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <Th label="Fecha" col="fecha_reserva" />
                <Th label="Cliente" col="nombre_cliente" />
                <Th label="Proyecto" col="proyecto" />
                <Th label="Unidad" col="unidad" />
                <Th label="Tipología" col="tipologia" />
                <Th label="Entrega" col="tipo_entrega" />
                <Th label="Valor Promesa UF" col="valor_promesa_uf" />
                <Th label="Estado" col="estado" />
                <Th label="Broker/BP" col="nivel_jerarquia_nombre" />
                <th className={styles.th} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className={styles.row} onClick={() => setSelected(r)}>
                  <td className={styles.td}>{formatDate(r.fecha_reserva)}</td>
                  <td className={styles.td}>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}>{getInitials(r.nombre_cliente)}</div>
                      <div>
                        <div className={styles.clientName}>{r.nombre_cliente}</div>
                        <div className={styles.clientSub}>{r.cliente_rut}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}><span className={styles.proyecto}>{r.proyecto}</span></td>
                  <td className={styles.td}>{r.unidad}</td>
                  <td className={styles.td}><span className={styles.tipologia}>{r.tipologia}</span></td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${r.tipo_entrega === 'inmediata' ? styles.accent : styles.primary}`}>
                      {r.tipo_entrega}
                    </span>
                  </td>
                  <td className={styles.td}>{formatUF(r.valor_promesa_uf)}</td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${styles[STATUS_COLORS[r.estado] || 'primary']}`}>
                      {r.revertida ? 'Revertida' : r.estado}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.bp}>
                      {r.miembro_equipo_interno
                        ? `${r.nivel_jerarquia_nombre} · ${r.miembro_equipo_interno}`
                        : r.nivel_jerarquia_nombre}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <button className={styles.viewBtn} onClick={e => { e.stopPropagation(); setSelected(r) }}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reservas.length === 0 && (
            <div className={styles.empty}>No se encontraron reservas con los filtros aplicados.</div>
          )}
        </div>
      )}

      {selected && <ReservaModal reserva={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
