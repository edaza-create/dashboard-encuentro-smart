import { filtrarReservasPorFecha } from '../utils/reservaFecha'

/**
 * Capital Open — Cyber (configurable por .env con prefijo VITE_).
 * VITE_CAPITAL_OPEN_NOMBRE, VITE_CAPITAL_OPEN_SUBTITULO, VITE_CAPITAL_OPEN_LOGO
 * VITE_CAPITAL_OPEN_LOGO_URL — ruta en /public (p. ej. /capital-open-logo.png) o URL absoluta. Usa PNG con transparencia.
 * VITE_CYBER_FECHA_DESDE, VITE_CYBER_FECHA_HASTA (YYYY-MM-DD, ventana única)
 */
export const capitalOpenConfig = {
  nombre: import.meta.env.VITE_CAPITAL_OPEN_NOMBRE?.trim() || 'Capital Open',
  subtitulo: import.meta.env.VITE_CAPITAL_OPEN_SUBTITULO?.trim() || 'Cyber Junio',
  logoAbrev: import.meta.env.VITE_CAPITAL_OPEN_LOGO?.trim() || 'CO',
  /** Logo oficial (archivo en /public o URL absoluta). */
  logoUrl: import.meta.env.VITE_CAPITAL_OPEN_LOGO_URL?.trim() || '/capital-open-logo.png',
  /** Ventana oficial Cyber (inclusive por fecha_reserva). */
  cyberDesde: import.meta.env.VITE_CYBER_FECHA_DESDE?.trim() || '2026-05-15',
  cyberHasta: import.meta.env.VITE_CYBER_FECHA_HASTA?.trim() || '2026-07-15',
}

/** Reservas cuya fecha_reserva cae dentro de la ventana Cyber configurada. */
export function reservasEnVentanaCyber(reservas) {
  return filtrarReservasPorFecha(reservas, capitalOpenConfig.cyberDesde, capitalOpenConfig.cyberHasta)
}
