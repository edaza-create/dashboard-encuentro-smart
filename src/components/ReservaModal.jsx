import { X, User, Building2, CreditCard, MapPin, Phone, Mail, Calendar } from 'lucide-react'
import styles from './ReservaModal.module.css'
import { formatUF, formatCLP, formatDate, formatPct } from '../utils/format'

function Row({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        <Icon size={14} />
        {title}
      </div>
      {children}
    </div>
  )
}

const STATUS_COLORS = {
  Pendiente: 'warning',
  Aprobado: 'accent',
  Cancelado: 'danger',
}

export default function ReservaModal({ reserva: r, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{r.nombre_cliente || 'Reserva sin datos de cliente'}</h2>
            <div className={styles.meta}>
              <span className={`${styles.badge} ${styles[STATUS_COLORS[r.estado] || 'primary']}`}>
                {r.revertida ? 'Revertida' : r.estado}
              </span>
              <span className={styles.metaSep}>·</span>
              <span>{r.proyecto} — Unidad {r.unidad}</span>
              <span className={styles.metaSep}>·</span>
              <span>{r.tipologia} Piso {r.piso}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.col}>
            <Section title="Datos del Cliente" icon={User}>
              {r.cliente_rut || r.cliente_email || r.cliente_telefono ? (
                <>
                  <Row label="RUT" value={r.cliente_rut} />
                  <Row label="Email" value={r.cliente_email} />
                  <Row label="Teléfono" value={r.cliente_telefono} />
                  <Row label="Profesión" value={r.profesion} />
                </>
              ) : (
                <p className={styles.sinDatos}>
                  Los datos de contacto están disponibles al iniciar sesión en el dashboard.
                </p>
              )}
            </Section>

            <Section title="Pago de Reserva" icon={CreditCard}>
              <Row label="Monto Pago" value={formatCLP(r.monto_pago)} />
              <Row label="UF Día Reserva" value={r.uf_valor_reserva ? `$${Number(r.uf_valor_reserva).toLocaleString('es-CL')}` : null} />
              <Row label="Banco Origen" value={r.banco_origen} />
              <Row label="Nº Cuenta" value={r.numero_cuenta} />
              <Row label="RUT Origen" value={r.rut_origen} />
            </Section>

            <Section title="Fechas" icon={Calendar}>
              <Row label="Fecha Reserva" value={formatDate(r.fecha_reserva)} />
              <Row label="Creada el" value={formatDate(r.created_at)} />
              <Row label="Tipo Entrega" value={r.tipo_entrega} />
            </Section>
          </div>

          <div className={styles.col}>
            <Section title="Datos del Proyecto" icon={Building2}>
              <Row label="Proyecto" value={r.proyecto} />
              <Row label="Inmobiliaria" value={r.inmobiliaria} />
              <Row label="Unidad" value={r.unidad} />
              <Row label="Piso" value={r.piso} />
              <Row label="Orientación" value={r.orientacion} />
              <Row label="Superficie Total" value={r.superficie_total ? `${(r.superficie_total / 100).toFixed(2)} m²` : null} />
              <Row label="Superficie Terraza" value={r.superficie_terraza ? `${(r.superficie_terraza / 100).toFixed(2)} m²` : null} />
            </Section>

            <Section title="Condiciones Comerciales" icon={CreditCard}>
              <Row label="Precio Lista" value={formatUF(r.valor_lista_uf)} />
              <Row label="Descuento" value={formatPct(r.descuento_porcentaje)} />
              <Row label="Valor Venta" value={formatUF(r.valor_venta_uf)} />
              <Row label="Bonificación" value={formatPct(r.bonificacion_porcentaje)} />
              <Row label="Valor Promesa" value={formatUF(r.valor_promesa_uf)} />
              <Row label="Pie" value={`${formatPct(r.pie_porcentaje)} — ${formatUF(r.pie_uf)}`} />
              <Row label="Crédito Hipotecario" value={formatUF(r.credito_hipotecario_uf)} />
            </Section>

            <Section title="Broker / Jerarquía" icon={MapPin}>
              <Row label="Asesor" value={r.nombre_asesor} />
              {r.miembro_equipo_interno ? (
                <Row label="Equipo comercial interno" value={r.miembro_equipo_interno} />
              ) : null}
              <Row label="Nivel" value={r.nivel_jerarquia_nombre} />
              <Row label="Email Broker" value={r.user_email} />
              <Row label="Tipo Reserva" value={r.tipo_reserva} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
