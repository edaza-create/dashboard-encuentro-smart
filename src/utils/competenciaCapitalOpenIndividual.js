import asesoresBpData from '../data/asesores-bp.json'
import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'
import { brokerTieneMapeo } from './brokerReservaMatch.js'
import { reservaMatchesBroker } from './brokerReservaMatch.js'
import { equipoIdForReservasAsesor, equipoLabelForId } from './competenciaIndividualToEquipo.js'
import { SCORING } from './competenciaCapitalOpenScore.js'
import { ufMontoPlanillaReserva } from './ufNormalize.js'
import { canonicalAsesorEmail } from './asesorEmail.js'

function bpSlugsEnCompetencia() {
  const slugs = new Set()
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      for (const s of b.bpSlugs || []) slugs.add(s)
    }
  }
  return slugs
}

function equipoIdForBpSlug(slug) {
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      if ((b.bpSlugs || []).includes(slug)) return String(eq.id)
    }
  }
  return null
}

/** Todos los niveles jerárquicos que participan en la competencia. */
export function allNombresPlataformaCompetencia() {
  const s = new Set()
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      for (const n of b.nombresPlataforma || []) {
        if (n) s.add(n)
      }
    }
  }
  return s
}

export function reservaEnCompetencia(r) {
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      if (!brokerTieneMapeo(b)) continue
      if (reservaMatchesBroker(r, b)) return true
    }
  }
  return false
}

export function reservasEnCompetencia(reservas) {
  if (!reservas?.length) return []
  return reservas.filter(reservaEnCompetencia)
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Clave estable para persistir puntos manuales por asesor.
 * Prioridad: nombre de asesor normalizado → email → nivel jerárquico.
 * Tildes removidas para que "Sebastián" y "Sebastian" generen la misma clave.
 */
export function asesorStorageKey(r) {
  const n = stripAccents(String(r.nombre_asesor ?? '').trim().toLowerCase())
  if (n) return `n:${n}`
  const e = canonicalAsesorEmail(r.user_email)
  if (e) return `e:${e}`
  return `l:${String(r.nivel_jerarquia_nombre ?? '')}`
}

/** Suma UF de las reservas del asesor (valor promesa; si es 0, valor venta; normalizado). */
export function ufTotalReservasAsesor(reservasAsesor) {
  if (!reservasAsesor?.length) return 0
  let sum = 0
  for (const r of reservasAsesor) {
    sum += ufMontoPlanillaReserva(r)
  }
  return Math.round(sum * 100) / 100
}

/**
 * Lista de asesores con reservas en competencia (ventana ya filtrada en el padre).
 */
export function listAsesoresCompetenciaIndividual(reservas) {
  const inComp = reservasEnCompetencia(reservas)
  const map = new Map()
  const reservasPorKey = new Map()
  for (const r of inComp) {
    const key = asesorStorageKey(r)
    if (!reservasPorKey.has(key)) reservasPorKey.set(key, [])
    reservasPorKey.get(key).push(r)
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        nombreAsesor: String(r.nombre_asesor ?? '').trim(),
        email: String(r.user_email ?? '').trim(),
        nivelJerarquia: String(r.nivel_jerarquia_nombre ?? '').trim(),
        reservas: 0,
      }
      map.set(key, g)
    }
    g.reservas += 1
    if (!g.nombreAsesor && r.nombre_asesor) g.nombreAsesor = String(r.nombre_asesor).trim()
    if (!g.email && r.user_email) g.email = String(r.user_email).trim()
    if (!g.nivelJerarquia && r.nivel_jerarquia_nombre) {
      g.nivelJerarquia = String(r.nivel_jerarquia_nombre).trim()
    }
  }
  const list = [...map.values()].map((g) => {
    const reservasAsesor = reservasPorKey.get(g.key) ?? []
    const equipoId = equipoIdForReservasAsesor(reservasAsesor)
    return {
      ...g,
      equipoId,
      equipoLabel: equipoLabelForId(equipoId),
      etiqueta: g.nombreAsesor || g.email || g.nivelJerarquia || '—',
      puntosReserva: g.reservas * SCORING.reservaPorRegistro,
      ufTotal: ufTotalReservasAsesor(reservasAsesor),
    }
  })
  // Merge roster asesores who are in competencia BPs but have no reservas yet
  const rosterSlugs = bpSlugsEnCompetencia()
  const existingKeys = new Set(list.map((a) => a.key))
  for (const asesor of asesoresBpData.asesores ?? []) {
    if (asesor.estado !== 'ACTIVO') continue
    if (!rosterSlugs.has(asesor.bp_slug)) continue
    const key = asesor.nombre
      ? `n:${stripAccents(asesor.nombre.trim().toLowerCase())}`
      : `e:${asesor.email.trim().toLowerCase()}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    const equipoId = equipoIdForBpSlug(asesor.bp_slug)
    list.push({
      key,
      nombreAsesor: asesor.nombre || '',
      email: asesor.email || '',
      nivelJerarquia: '',
      reservas: 0,
      equipoId,
      equipoLabel: equipoLabelForId(equipoId),
      etiqueta: asesor.nombre || asesor.email || '—',
      puntosReserva: 0,
      ufTotal: 0,
    })
  }

  list.sort((a, b) => {
    if (b.puntosReserva !== a.puntosReserva) return b.puntosReserva - a.puntosReserva
    return a.etiqueta.localeCompare(b.etiqueta, 'es', { sensitivity: 'base' })
  })
  return list
}

export function puntosManualIndividual(entry) {
  if (!entry) return { promesas: 0, escrituras: 0 }
  const promesas = Math.max(0, Number(entry.promesasCount) || 0) * SCORING.promesaPorRegistro
  const escrituras = Math.max(0, Number(entry.escriturasCount) || 0) * SCORING.escrituraPorRegistro
  return { promesas, escrituras }
}

export function totalIndividual(entry, reservasCount) {
  const auto = reservasCount * SCORING.reservaPorRegistro
  const m = puntosManualIndividual(entry)
  return auto + m.promesas + m.escrituras
}
