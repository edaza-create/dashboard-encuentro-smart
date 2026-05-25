import { resolveAsesorMaestra, rosterEmailsPorEquipoCapitalOpen } from './asesorMaestra.js'

/**
 * Detecta asesores activos que no registraron asistencia en una reunión.
 *
 * @param {Array<{ email: string }>} registros — filas de asistencia_registros para una reunión
 * @returns {Array<{ email: string, nombre: string|null, subgrupo: string, equipo: string|null }>}
 */
export function detectarAusentes(registros) {
  const emailsPresentes = new Set(registros.map((r) => r.email.toLowerCase()))
  const roster = rosterEmailsPorEquipoCapitalOpen()
  const ausentes = []

  for (const emails of roster.values()) {
    for (const email of emails) {
      if (emailsPresentes.has(email)) continue
      const info = resolveAsesorMaestra(email)
      if (!info.ok) continue
      ausentes.push({
        email: info.email,
        nombre: info.nombre,
        subgrupo: info.subgrupo,
        equipo: info.equipo,
      })
    }
  }

  ausentes.sort((a, b) => (a.equipo ?? '').localeCompare(b.equipo ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? ''))
  return ausentes
}
