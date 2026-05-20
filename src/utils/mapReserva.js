import { lookupAsesorBp } from './asesorBpPlataforma.js'
import { enrichReservaEquipoInterno } from './equipoComercialInterno.js'

/**
 * Unifica tipología: ESTUDIO / Estudio / ESTUDIOS / STUDIO → "Studio" (identificador estándar).
 * Cualquier otro valor se mantiene tal cual llega (tras trim).
 */
export function normalizeTipologia(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const compact = s.replace(/\s+/g, ' ').trim()
  if (/^estudios?$/i.test(compact)) return 'Studio'
  if (/^studios?$/i.test(compact)) return 'Studio'
  return s
}

/**
 * Normaliza una fila de PostgREST al shape que usa el dashboard (mock JSON).
 * Acepta alias comunes por si el esquema difiere ligeramente.
 */
export function mapReservaRow(row) {
  if (!row || typeof row !== 'object') return null

  const tipoRaw = (row.tipo_entrega ?? row.tipoEntrega ?? '').toString().trim().toLowerCase()
  let tipo_entrega = tipoRaw
  if (tipoRaw === 'inmediata' || tipoRaw === 'immediate' || tipoRaw === 'inmediato') tipo_entrega = 'inmediata'
  else if (tipoRaw === 'futura' || tipoRaw === 'future' || tipoRaw === 'futuro') tipo_entrega = 'futura'

  const num = (v, d = 0) => (v == null || v === '' ? d : Number(v))

  const mapped = {
    id: String(row.id ?? row.reserva_id ?? ''),
    nombre_cliente: row.nombre_cliente ?? row.nombreCliente ?? row.cliente_nombre ?? '',
    user_email: row.user_email ?? row.userEmail ?? row.broker_email ?? '',
    estado: row.estado ?? '',
    fecha_reserva: row.fecha_reserva ?? row.fechaReserva ?? null,
    tipologia: normalizeTipologia(row.tipologia ?? row.tipo_tipologia ?? ''),
    orientacion: row.orientacion ?? '',
    piso: num(row.piso, 0),
    superficie_total: num(row.superficie_total, 0),
    superficie_terraza: num(row.superficie_terraza, 0),
    valor_lista_uf: num(row.valor_lista_uf, 0),
    descuento_porcentaje: num(row.descuento_porcentaje, 0),
    valor_venta_uf: num(row.valor_venta_uf, 0),
    bonificacion_porcentaje: num(row.bonificacion_porcentaje, 0),
    valor_promesa_uf: num(row.valor_promesa_uf, 0),
    pie_porcentaje: num(row.pie_porcentaje, 0),
    pie_uf: num(row.pie_uf, 0),
    credito_hipotecario_uf: num(row.credito_hipotecario_uf, 0),
    monto_pago: num(row.monto_pago, 0),
    tipo_entrega,
    nivel_jerarquia_nombre: row.nivel_jerarquia_nombre ?? row.nivel_jerarquia ?? row.broker_nombre ?? '',
    /** Asesor comercial (si la plataforma lo envía). */
    nombre_asesor:
      row.nombre_asesor ??
      row.asesor_nombre ??
      row.asesor ??
      row.nombre_asesor_comercial ??
      row.ejecutivo_nombre ??
      row.nombre_ejecutivo ??
      '',
    tipo_reserva: row.tipo_reserva ?? 'reserva',
    revertida: Boolean(row.revertida),
    archivado: Boolean(row.archivado),
    created_at: row.created_at ?? row.createdAt ?? null,
    proyecto: row.proyecto ?? row.proyecto_nombre ?? '',
    comuna: row.direccion_comuna ?? row.comuna ?? row.comuna_nombre ?? '',
    unidad: row.unidad != null ? String(row.unidad) : '',
    inmobiliaria: row.inmobiliaria ?? '',
    cliente_rut: row.cliente_rut ?? row.rut_cliente ?? '',
    cliente_telefono: row.cliente_telefono ?? '',
    cliente_email: row.cliente_email ?? '',
    profesion: row.profesion ?? '',
    uf_valor_reserva: num(row.uf_valor_reserva, 0),
    banco_origen: row.banco_origen ?? '',
    numero_cuenta: row.numero_cuenta != null ? String(row.numero_cuenta) : '',
    rut_origen: row.rut_origen ?? '',
    nombre_completo_origen: row.nombre_completo_origen ?? '',
  }

  return enrichReservaEquipoInterno(mapped)
}

function tipologiaFromUnidad(unidad) {
  const s = String(unidad ?? '')
  const m = s.match(/\b(\d+D\+\d+B|Studio|Estudio|ESTUDIO)\b/i)
  return m ? normalizeTipologia(m[1]) : ''
}

/**
 * Mapea una fila del endpoint publico ored al shape del dashboard.
 * @param {import('../api/rankingClient.js').ReservaPublica} row
 */
export function mapReservaPublica(row) {
  if (!row || typeof row !== 'object') return null

  const email = row.asesor_email ?? ''
  const bp = lookupAsesorBp(email)
  const fechaReserva = row.fecha ?? (row.ocurrido_en ? String(row.ocurrido_en).slice(0, 10) : null)
  const montoUf = row.monto_uf == null ? 0 : Number(row.monto_uf)

  const mapped = {
    id: String(row.reserva_id ?? ''),
    nombre_cliente: '',
    user_email: email,
    estado: 'Registrada',
    fecha_reserva: fechaReserva,
    tipologia: tipologiaFromUnidad(row.unidad),
    orientacion: '',
    piso: 0,
    superficie_total: 0,
    superficie_terraza: 0,
    valor_lista_uf: montoUf,
    descuento_porcentaje: 0,
    valor_venta_uf: montoUf,
    bonificacion_porcentaje: 0,
    valor_promesa_uf: montoUf,
    pie_porcentaje: 0,
    pie_uf: 0,
    credito_hipotecario_uf: 0,
    monto_pago: 0,
    tipo_entrega: '',
    nivel_jerarquia_nombre: bp.nivel_jerarquia_nombre,
    nombre_asesor: row.asesor_nombre ?? bp.nombre ?? '',
    tipo_reserva: 'reserva',
    revertida: false,
    archivado: false,
    created_at: row.ocurrido_en ?? null,
    proyecto: row.proyecto ?? '',
    comuna: '',
    unidad: row.unidad != null ? String(row.unidad) : '',
    inmobiliaria: row.inmobiliaria ?? '',
    cliente_rut: '',
    cliente_telefono: '',
    cliente_email: '',
    profesion: '',
    uf_valor_reserva: 0,
    banco_origen: '',
    numero_cuenta: '',
    rut_origen: '',
    nombre_completo_origen: '',
  }

  return enrichReservaEquipoInterno(mapped)
}
