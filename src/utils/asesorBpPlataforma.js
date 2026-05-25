import asesoresBP from '../data/asesores-bp.json' with { type: 'json' }
import { BP_SLUG_TO_PLATAFORMA as BP_PLATAFORMA_CATALOG } from '../data/bpCatalog.js'
import { lookupEquipoInternoBp } from './equipoComercialInterno.js'
import { NIVEL_PLATAFORMA_EQUIPO_INTERNO, BP_SLUG_EQUIPO_INTERNO } from '../data/equipoComercialInterno.js'

/** Primer nombre de plataforma por slug de BP (catálogo + equipo interno). */
const BP_SLUG_TO_PLATAFORMA = {
  [BP_SLUG_EQUIPO_INTERNO]: NIVEL_PLATAFORMA_EQUIPO_INTERNO,
  ...BP_PLATAFORMA_CATALOG,
}

const emailToAsesor = new Map()
for (const a of asesoresBP.asesores) {
  if (a?.email) emailToAsesor.set(a.email.toLowerCase(), a)
}

/**
 * @param {string|null|undefined} email
 * @returns {{ bp_slug: string|null, nombre: string|null, nivel_jerarquia_nombre: string }}
 */
export function lookupAsesorBp(email) {
  const key = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!key) {
    return { bp_slug: null, nombre: null, nivel_jerarquia_nombre: '' }
  }
  const interno = lookupEquipoInternoBp(key)
  if (interno) return interno
  const row = emailToAsesor.get(key)
  if (!row) {
    return { bp_slug: null, nombre: null, nivel_jerarquia_nombre: '' }
  }
  const plataforma = BP_SLUG_TO_PLATAFORMA[row.bp_slug] ?? ''
  return {
    bp_slug: row.bp_slug ?? null,
    nombre: row.nombre ?? null,
    nivel_jerarquia_nombre: plataforma,
  }
}
