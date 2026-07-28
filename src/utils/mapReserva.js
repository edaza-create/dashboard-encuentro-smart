import { lookupAsesorBp } from './asesorBpPlataforma.js'
import { enrichReservaEquipoInterno } from './equipoComercialInterno.js'
import { estadoEsCaida } from './reservaVigente.js'
import { canonicalAsesorEmail } from './asesorEmail.js'

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
    user_email:
      canonicalAsesorEmail(row.user_email ?? row.userEmail ?? row.broker_email ?? '') ?? '',
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
    revertida: Boolean(row.revertida) || estadoEsCaida(row.estado),
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

  if (mapped.user_email) {
    const bp = lookupAsesorBp(mapped.user_email)
    if (bp.bp_slug) {
      mapped.nivel_jerarquia_nombre = bp.nivel_jerarquia_nombre
      if (!String(mapped.nombre_asesor ?? '').trim() && bp.nombre) {
        mapped.nombre_asesor = bp.nombre
      }
    }
  }

  return enrichReservaEquipoInterno(mapped)
}

/**
 * Mapea una fila del proxy de Atlas Engine al shape del dashboard.
 *
 * A diferencia de ored, Atlas SI informa el estado real de la reserva, asi que
 * `revertida` refleja las caidas (event_kind === 'fallen') en vez de forzarse a
 * false. El conteo de competencia las excluye.
 *
 * @param {import('../api/atlasClient.js').ReservaAtlas} row
 */
export function mapReservaAtlas(row) {
  if (!row || typeof row !== 'object') return null

  const email = canonicalAsesorEmail(row.asesor_email ?? '') ?? ''
  const bp = lookupAsesorBp(email)
  const montoUf = row.monto_uf == null ? 0 : Number(row.monto_uf)
  const revertida = Boolean(row.revertida)

  const mapped = {
    id: String(row.reserva_id ?? ''),
    /** Identidad de la reserva en Brekto: Atlas emite una fila por evento. */
    brekto_id: row.brekto_id ?? null,
    nombre_cliente: '',
    user_email: email,
    estado: row.estado ?? '',
    fecha_reserva: row.fecha ?? (row.ocurrido_en ? String(row.ocurrido_en).slice(0, 10) : null),
    tipologia: normalizeTipologia(row.tipologia ?? ''),
    orientacion: '',
    piso: 0,
    superficie_total: 0,
    superficie_terraza: 0,
    valor_lista_uf: montoUf,
    descuento_porcentaje: 0,
    valor_venta_uf: montoUf,
    bonificacion_porcentaje: 0,
    valor_promesa_uf: montoUf,
    /** Atlas entrega UF limpias: no pasar por el normalizador de planilla. */
    uf_ya_normalizada: true,
    pie_porcentaje: 0,
    pie_uf: 0,
    credito_hipotecario_uf: 0,
    monto_pago: 0,
    tipo_entrega: '',
    nivel_jerarquia_nombre: bp.nivel_jerarquia_nombre,
    nombre_asesor: row.asesor_nombre ?? bp.nombre ?? '',
    tipo_reserva: 'reserva',
    revertida,
    archivado: false,
    event_kind: row.event_kind ?? '',
    created_at: row.ocurrido_en ?? null,
    proyecto: row.proyecto ?? '',
    comuna: row.comuna ?? '',
    unidad: '',
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

  const email = canonicalAsesorEmail(row.asesor_email ?? '') ?? ''
  const bp = lookupAsesorBp(email)
  const fechaReserva = row.fecha ?? (row.ocurrido_en ? String(row.ocurrido_en).slice(0, 10) : null)
  const montoUf = row.monto_uf == null ? 0 : Number(row.monto_uf)

  const mapped = {
    id: String(row.reserva_id ?? ''),
    brekto_id: row.brekto_id ?? null,
    // Solo el endpoint privado de ored entrega datos de cliente; desde el
    // publico llegan undefined y quedan vacios.
    nombre_cliente: row.nombre_cliente ?? '',
    user_email: email,
    estado: row.estado ?? 'Registrada',
    fecha_reserva: fechaReserva,
    // ored no trae tipologia como campo: se extrae del texto de `unidad`. El
    // proxy privado, cuando la fuente es Atlas, si la manda explicita.
    tipologia: row.tipologia
      ? normalizeTipologia(row.tipologia)
      : tipologiaFromUnidad(row.unidad),
    orientacion: '',
    piso: 0,
    superficie_total: 0,
    superficie_terraza: 0,
    valor_lista_uf: montoUf,
    descuento_porcentaje: 0,
    valor_venta_uf: montoUf,
    bonificacion_porcentaje: 0,
    valor_promesa_uf: montoUf,
    /**
     * Siempre true: este mapper solo recibe filas de API (`monto_uf` de ored o
     * de Atlas ya normalizado por el proxy), y todas traen la UF limpia.
     *
     * `ufNormalizadoPlanilla()` existe para reparar valores malformados de la
     * planilla xlsx —toma los primeros 4 digitos— y aplicado a estos datos
     * dividiria por 10 cualquier propiedad de 10.000 UF o mas. Hoy no hay
     * ninguna en la ventana, pero la primera que aparezca perderia el 90% de su
     * valor sin avisar.
     */
    uf_ya_normalizada: true,
    pie_porcentaje: 0,
    pie_uf: 0,
    credito_hipotecario_uf: 0,
    monto_pago: 0,
    tipo_entrega: '',
    nivel_jerarquia_nombre: bp.nivel_jerarquia_nombre,
    nombre_asesor: row.asesor_nombre ?? bp.nombre ?? '',
    tipo_reserva: 'reserva',
    // ored expone el estado crudo de Brekto y no filtra: Cancelado y Rechazado
    // son caidas y no deben puntuar. Ver docs/API-ranking-ored.md seccion 4.
    revertida: Boolean(row.revertida) || estadoEsCaida(row.estado),
    archivado: Boolean(row.archivado),
    created_at: row.ocurrido_en ?? null,
    proyecto: row.proyecto ?? '',
    comuna: row.comuna ?? '',
    unidad: row.unidad != null ? String(row.unidad) : '',
    inmobiliaria: row.inmobiliaria ?? '',
    cliente_rut: row.cliente_rut ?? '',
    cliente_telefono: row.cliente_telefono ?? '',
    cliente_email: row.cliente_email ?? '',
    profesion: '',
    uf_valor_reserva: 0,
    banco_origen: '',
    numero_cuenta: '',
    rut_origen: '',
    nombre_completo_origen: '',
  }

  return enrichReservaEquipoInterno(mapped)
}
