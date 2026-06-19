import { format } from 'date-fns'

/** Fecha local YYYY-MM-DD (misma convención que filtros del dashboard). */
export function todayISOLocal(now = new Date()) {
  return format(now, 'yyyy-MM-dd')
}

/**
 * Fecha de la reunión para reglas de puntos: `fecha_evento` o, si falta, día del QR/creación.
 * @param {{ fecha_evento?: string|null, qr_generated_at?: string|null, created_at?: string|null }} reunion
 * @returns {string|null} YYYY-MM-DD
 */
export function fechaEfectivaReunion(reunion) {
  if (reunion?.fecha_evento) return String(reunion.fecha_evento).slice(0, 10)
  const iso = reunion?.qr_generated_at ?? reunion?.created_at
  if (!iso) return null
  return format(new Date(iso), 'yyyy-MM-dd')
}

/**
 * Solo reuniones con fecha efectiva >= hoy suman puntos en competencia.
 * @param {{ fecha_evento?: string|null, qr_generated_at?: string|null, created_at?: string|null }} reunion
 * @param {string} [corteDesde] YYYY-MM-DD inclusive (default: hoy local)
 */
export function reunionCuentaParaPuntos(reunion, corteDesde = todayISOLocal()) {
  const fecha = fechaEfectivaReunion(reunion)
  if (!fecha) return false
  return fecha >= corteDesde
}
