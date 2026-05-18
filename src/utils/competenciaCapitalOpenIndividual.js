import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams'
import { SCORING } from './competenciaCapitalOpenScore'

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

export function reservasEnCompetencia(reservas) {
  const set = allNombresPlataformaCompetencia()
  if (!set.size || !reservas?.length) return []
  return reservas.filter((r) => set.has(r.nivel_jerarquia_nombre))
}

/**
 * Clave estable para persistir puntos manuales por asesor.
 * Prioridad: nombre de asesor normalizado → email → nivel jerárquico.
 */
export function asesorStorageKey(r) {
  const n = String(r.nombre_asesor ?? '').trim().toLowerCase()
  if (n) return `n:${n}`
  const e = String(r.user_email ?? '').trim().toLowerCase()
  if (e) return `e:${e}`
  return `l:${String(r.nivel_jerarquia_nombre ?? '')}`
}

/**
 * Lista de asesores con reservas en competencia (ventana ya filtrada en el padre).
 */
export function listAsesoresCompetenciaIndividual(reservas) {
  const inComp = reservasEnCompetencia(reservas)
  const map = new Map()
  for (const r of inComp) {
    const key = asesorStorageKey(r)
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
  }
  const list = [...map.values()].map((g) => ({
    ...g,
    etiqueta: g.nombreAsesor || g.email || g.nivelJerarquia || '—',
    puntosReserva: g.reservas * SCORING.reservaPorRegistro,
  }))
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
