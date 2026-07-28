import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'

export const COMPETENCIA_TEAM_STORAGE_KEY = 'capital-open-competencia-manual-v1'
export const COMPETENCIA_INDIVIDUAL_STORAGE_KEY = 'capital-open-competencia-individual-v1'

export const COMPETENCIA_MANUAL_UPDATED_EVENT = 'competencia-manual-updated'

const BROADCAST_CHANNEL_NAME = 'encuentro-smart-competencia-manual-v1'

/** Caché en memoria (Supabase); prioridad sobre localStorage en lecturas. */
let remoteManualCache = {
  individualRaw: null,
  teamRaw: null,
}

/** @type {BroadcastChannel | null} */
let broadcastChannel = null

function getBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  }
  return broadcastChannel
}

export function notifyCompetenciaManualUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COMPETENCIA_MANUAL_UPDATED_EVENT))
  try {
    getBroadcastChannel()?.postMessage({ at: Date.now() })
  } catch {
    /* ignore */
  }
}

/**
 * Escucha cambios de puntos manuales (misma pestaña, otras pestañas u otro origen local).
 * @param {() => void} onUpdate
 * @returns {() => void}
 */
export function subscribeCompetenciaManualUpdated(onUpdate) {
  if (typeof window === 'undefined') return () => {}

  const bump = () => onUpdate()

  window.addEventListener(COMPETENCIA_MANUAL_UPDATED_EVENT, bump)

  const onStorage = (e) => {
    if (
      e.key === COMPETENCIA_TEAM_STORAGE_KEY ||
      e.key === COMPETENCIA_INDIVIDUAL_STORAGE_KEY
    ) {
      bump()
    }
  }
  window.addEventListener('storage', onStorage)

  const channel = getBroadcastChannel()
  const onMessage = () => bump()
  channel?.addEventListener('message', onMessage)

  return () => {
    window.removeEventListener(COMPETENCIA_MANUAL_UPDATED_EVENT, bump)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onMessage)
  }
}

function defaultTeamSavedEntry() {
  return {
    promesasCount: 0,
    escriturasCount: 0,
    actividadOnlineCount: 0,
    actividadPresencialCount: 0,
  }
}

function defaultTeamsMapSaved() {
  return Object.fromEntries(EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), defaultTeamSavedEntry()]))
}

/**
 * Actualiza la caché remota usada por el ranking público y el dashboard.
 * @param {{ individualRaw?: object | null, teamRaw?: object | null }} payload
 */
export function applyRemoteManualCache(payload) {
  if (payload.individualRaw !== undefined) {
    remoteManualCache.individualRaw = payload.individualRaw
  }
  if (payload.teamRaw !== undefined) {
    remoteManualCache.teamRaw = payload.teamRaw
  }
  notifyCompetenciaManualUpdated()
}

export function clearRemoteManualCache() {
  remoteManualCache = { individualRaw: null, teamRaw: null }
}

function loadTeamManualFromRaw(raw) {
  try {
    const base = defaultTeamsMapSaved()
    const teams = raw?.teams
    if (!teams || typeof teams !== 'object') return base
    for (const id of Object.keys(base)) {
      const t = teams[id]
      if (!t || typeof t !== 'object') continue
      const promesasCount = Math.max(0, Math.min(9999, Math.floor(Number(t.promesasCount) || 0)))
      const escriturasCount = Math.max(0, Math.min(9999, Math.floor(Number(t.escriturasCount) || 0)))
      let actividadOnlineCount = Math.max(0, Math.min(999, Math.floor(Number(t.actividadOnlineCount) || 0)))
      let actividadPresencialCount = Math.max(0, Math.min(999, Math.floor(Number(t.actividadPresencialCount) || 0)))
      if (t.actividadOnlineCount == null && t.actividadOnline === true) actividadOnlineCount = Math.max(actividadOnlineCount, 1)
      if (t.actividadPresencialCount == null && t.actividadPresencial === true) {
        actividadPresencialCount = Math.max(actividadPresencialCount, 1)
      }
      base[id] = { promesasCount, escriturasCount, actividadOnlineCount, actividadPresencialCount }
    }
    return base
  } catch {
    return defaultTeamsMapSaved()
  }
}

export function loadTeamManualSaved() {
  if (remoteManualCache.teamRaw != null) {
    return loadTeamManualFromRaw(remoteManualCache.teamRaw)
  }
  try {
    const raw = JSON.parse(localStorage.getItem(COMPETENCIA_TEAM_STORAGE_KEY) || 'null')
    return loadTeamManualFromRaw(raw)
  } catch {
    return defaultTeamsMapSaved()
  }
}

/**
 * null si no hay ajuste manual de reservas; si lo hay, un entero acotado.
 * Duplica a proposito la normalizacion del hook: este modulo no puede importarlo
 * sin crear un ciclo, y ambos leen el mismo campo persistido.
 */
function normalizeReservasOverrideRaw(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(9999, Math.floor(n)))
}

function loadIndividualManualFromRaw(raw) {
  try {
    const asesores = raw?.asesores
    if (!asesores || typeof asesores !== 'object') return {}
    const out = {}
    for (const id of Object.keys(asesores)) {
      const t = asesores[id]
      if (!t || typeof t !== 'object') continue
      out[id] = {
        promesasCount: Math.max(0, Math.min(9999, Math.floor(Number(t.promesasCount) || 0))),
        escriturasCount: Math.max(0, Math.min(9999, Math.floor(Number(t.escriturasCount) || 0))),
        // Ajuste manual del conteo de reservas: null = usar el automatico.
        // Sin esto, la pestana de equipos y /cyber ignorarian la correccion.
        reservasOverride: normalizeReservasOverrideRaw(t.reservasOverride),
      }
    }
    return out
  } catch {
    return {}
  }
}

export function loadIndividualManualSaved() {
  if (remoteManualCache.individualRaw != null) {
    return loadIndividualManualFromRaw(remoteManualCache.individualRaw)
  }
  try {
    const raw = JSON.parse(localStorage.getItem(COMPETENCIA_INDIVIDUAL_STORAGE_KEY) || 'null')
    return loadIndividualManualFromRaw(raw)
  } catch {
    return {}
  }
}

/** Persiste en localStorage (caché offline) sin notificar. */
export function writeIndividualManualLocal(asesores) {
  try {
    localStorage.setItem(
      COMPETENCIA_INDIVIDUAL_STORAGE_KEY,
      JSON.stringify({ version: 1, asesores })
    )
  } catch {
    /* ignore */
  }
}

export function writeTeamManualLocal(teams) {
  try {
    localStorage.setItem(
      COMPETENCIA_TEAM_STORAGE_KEY,
      JSON.stringify({ version: 1, teams })
    )
  } catch {
    /* ignore */
  }
}

/** Payload completo para Supabase (individual). */
export function readIndividualManualPayload() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPETENCIA_INDIVIDUAL_STORAGE_KEY) || 'null')
    if (raw?.asesores && typeof raw.asesores === 'object') {
      return { version: 1, asesores: raw.asesores }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, asesores: {} }
}

/** Payload completo para Supabase (equipos). */
export function readTeamManualPayload() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPETENCIA_TEAM_STORAGE_KEY) || 'null')
    if (raw?.teams && typeof raw.teams === 'object') {
      return { version: 1, teams: raw.teams }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, teams: {} }
}
