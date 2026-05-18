import { useCallback, useEffect, useState } from 'react'
import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams'

const STORAGE_KEY = 'capital-open-competencia-manual-v1'

/** Lo que persiste en localStorage (incluye acumulados de actividades). */
function defaultSavedEntry() {
  return {
    promesasCount: 0,
    escriturasCount: 0,
    actividadOnlineCount: 0,
    actividadPresencialCount: 0,
  }
}

/** Borrador en pantalla: promesas/escrituras editables + marcas puntuales para el próximo Guardar. */
function defaultDraftEntry() {
  return {
    promesasCount: 0,
    escriturasCount: 0,
    registrarOnline: false,
    registrarPresencial: false,
  }
}

function defaultTeamsMapSaved() {
  return Object.fromEntries(EQUIPOS_CAPITAL_ONE.map((e) => [String(e.id), defaultSavedEntry()]))
}

function defaultTeamsMapDraftFromSaved(saved) {
  const out = {}
  for (const id of Object.keys(saved)) {
    const s = saved[id] || defaultSavedEntry()
    out[id] = {
      promesasCount: s.promesasCount,
      escriturasCount: s.escriturasCount,
      registrarOnline: false,
      registrarPresencial: false,
    }
  }
  return out
}

function normalizeLoaded(raw) {
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
    if (t.actividadPresencialCount == null && t.actividadPresencial === true)
      actividadPresencialCount = Math.max(actividadPresencialCount, 1)

    base[id] = {
      promesasCount,
      escriturasCount,
      actividadOnlineCount,
      actividadPresencialCount,
    }
  }
  return base
}

function isTeamDirty(draft, saved, id) {
  const d = draft[id] || defaultDraftEntry()
  const s = saved[id] || defaultSavedEntry()
  if (d.promesasCount !== s.promesasCount || d.escriturasCount !== s.escriturasCount) return true
  if (d.registrarOnline || d.registrarPresencial) return true
  return false
}

export function useCompetenciaManualPoints() {
  const [savedTeams, setSavedTeams] = useState(() => defaultTeamsMapSaved())
  const [draftTeams, setDraftTeams] = useState(() => defaultTeamsMapDraftFromSaved(defaultTeamsMapSaved()))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      const normalized = normalizeLoaded(raw)
      setSavedTeams(normalized)
      setDraftTeams(defaultTeamsMapDraftFromSaved(normalized))
    } catch {
      const z = defaultTeamsMapSaved()
      setSavedTeams(z)
      setDraftTeams(defaultTeamsMapDraftFromSaved(z))
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, teams: savedTeams }))
    } catch {
      /* ignore */
    }
  }, [savedTeams, hydrated])

  const patchDraft = useCallback((teamId, patch) => {
    const id = String(teamId)
    setDraftTeams((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || defaultDraftEntry()), ...patch },
    }))
  }, [])

  const saveTeam = useCallback((teamId) => {
    const id = String(teamId)
    setDraftTeams((d) => {
      const draft = { ...(d[id] || defaultDraftEntry()) }
      setSavedTeams((s) => {
        const prev = s[id] || defaultSavedEntry()
        const next = {
          promesasCount: Math.max(0, Math.min(9999, Math.floor(Number(draft.promesasCount) || 0))),
          escriturasCount: Math.max(0, Math.min(9999, Math.floor(Number(draft.escriturasCount) || 0))),
          actividadOnlineCount: Math.min(
            999,
            (prev.actividadOnlineCount || 0) + (draft.registrarOnline ? 1 : 0)
          ),
          actividadPresencialCount: Math.min(
            999,
            (prev.actividadPresencialCount || 0) + (draft.registrarPresencial ? 1 : 0)
          ),
        }
        return { ...s, [id]: next }
      })
      return {
        ...d,
        [id]: {
          promesasCount: Math.max(0, Math.min(9999, Math.floor(Number(draft.promesasCount) || 0))),
          escriturasCount: Math.max(0, Math.min(9999, Math.floor(Number(draft.escriturasCount) || 0))),
          registrarOnline: false,
          registrarPresencial: false,
        },
      }
    })
  }, [])

  const resetManual = useCallback(() => {
    const z = defaultTeamsMapSaved()
    setSavedTeams(z)
    setDraftTeams(defaultTeamsMapDraftFromSaved(z))
  }, [])

  const isTeamDirtyFn = useCallback(
    (teamId) => isTeamDirty(draftTeams, savedTeams, String(teamId)),
    [draftTeams, savedTeams]
  )

  return {
    savedTeams,
    draftTeams,
    patchDraft,
    saveTeam,
    resetManual,
    hydrated,
    isTeamDirty: isTeamDirtyFn,
  }
}
