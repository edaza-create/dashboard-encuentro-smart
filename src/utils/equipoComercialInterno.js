import {
  MIEMBROS_EQUIPO_COMERCIAL_INTERNO,
  NIVEL_PLATAFORMA_EQUIPO_INTERNO,
  BP_SLUG_EQUIPO_INTERNO,
} from '../data/equipoComercialInterno.js'

function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const emailToMiembro = new Map()
const aliasToMiembro = new Map()

for (const m of MIEMBROS_EQUIPO_COMERCIAL_INTERNO) {
  for (const email of m.emails) {
    emailToMiembro.set(email.toLowerCase(), m)
  }
  aliasToMiembro.set(normalizeText(m.nombre), m)
  for (const a of m.aliases) {
    aliasToMiembro.set(normalizeText(a), m)
  }
}

function emailFromReserva(r) {
  return String(r?.user_email ?? r?.asesor_email ?? '').trim().toLowerCase()
}

function nombreFromReserva(r) {
  return String(r?.nombre_asesor ?? r?.asesor_nombre ?? '').trim()
}

/**
 * @param {string} email
 * @returns {import('../data/equipoComercialInterno.js').MiembroEquipoInterno | null}
 */
export function miembroPorEmail(email) {
  const key = String(email ?? '').trim().toLowerCase()
  if (!key) return null
  return emailToMiembro.get(key) ?? null
}

/**
 * Coincidencia por nombre completo o alias registrado.
 * @param {string} nombre
 * @returns {import('../data/equipoComercialInterno.js').MiembroEquipoInterno | null}
 */
export function miembroPorNombre(nombre) {
  const n = normalizeText(nombre)
  if (!n) return null
  if (aliasToMiembro.has(n)) return aliasToMiembro.get(n)
  for (const m of MIEMBROS_EQUIPO_COMERCIAL_INTERNO) {
    const tokens = normalizeText(m.nombre).split(' ').filter(Boolean)
    if (tokens.length >= 2 && tokens.every((t) => n.includes(t))) return m
  }
  return null
}

/**
 * @param {object} r
 * @returns {import('../data/equipoComercialInterno.js').MiembroEquipoInterno | null}
 */
export function miembroEquipoInternoFromReserva(r) {
  if (!r) return null
  const byEmail = miembroPorEmail(emailFromReserva(r))
  if (byEmail) return byEmail
  return miembroPorNombre(nombreFromReserva(r))
}

export function isReservaEquipoComercialInterno(r) {
  if (!r) return false
  if (miembroEquipoInternoFromReserva(r)) return true
  const nivel = normalizeText(r.nivel_jerarquia_nombre)
  return nivel === normalizeText(NIVEL_PLATAFORMA_EQUIPO_INTERNO)
}

/**
 * Enriquece la reserva con BP del equipo interno y nombre del asesor cuando aplica.
 * @template T
 * @param {T} r
 * @returns {T & { miembro_equipo_interno?: string, miembro_equipo_interno_id?: string }}
 */
export function enrichReservaEquipoInterno(r) {
  if (!r) return r
  const miembro = miembroEquipoInternoFromReserva(r)
  const nivelActual = String(r.nivel_jerarquia_nombre ?? '').trim()
  const esNivelInterno =
    normalizeText(nivelActual) === normalizeText(NIVEL_PLATAFORMA_EQUIPO_INTERNO)

  if (!miembro && !esNivelInterno) return r

  const out = { ...r }
  if (miembro || esNivelInterno) {
    out.nivel_jerarquia_nombre = NIVEL_PLATAFORMA_EQUIPO_INTERNO
  }
  if (miembro) {
    out.miembro_equipo_interno = miembro.nombre
    out.miembro_equipo_interno_id = miembro.id
    if (!String(out.nombre_asesor ?? '').trim()) {
      out.nombre_asesor = miembro.nombre
    }
  }
  return out
}

/** Lookup alineado con asesorBpPlataforma. */
export function lookupEquipoInternoBp(email) {
  const miembro = miembroPorEmail(email)
  if (!miembro) return null
  return {
    bp_slug: BP_SLUG_EQUIPO_INTERNO,
    nombre: miembro.nombre,
    nivel_jerarquia_nombre: NIVEL_PLATAFORMA_EQUIPO_INTERNO,
  }
}

export function listMiembrosEquipoInterno() {
  return MIEMBROS_EQUIPO_COMERCIAL_INTERNO.map((m) => ({
    id: m.id,
    nombre: m.nombre,
  }))
}
