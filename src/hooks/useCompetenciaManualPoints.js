import { useCallback, useEffect, useRef, useState } from 'react'
import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams'
import {
  fetchCompetenciaManualRemote,
  isCompetenciaManualRemoteEnabled,
  pushCompetenciaManualRemote,
  remotePushReasonMessage,
} from '../api/competenciaManualRemote.js'
import {
  COMPETENCIA_TEAM_STORAGE_KEY as STORAGE_KEY,
  applyRemoteManualCache,
  notifyCompetenciaManualUpdated,
  writeTeamManualLocal,
} from '../utils/competenciaStorage.js'

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
  if (d.registrarOnline || d.registrarPresencial) return true
  return false
}

export function useCompetenciaManualPoints() {
  const [savedTeams, setSavedTeams] = useState(() => defaultTeamsMapSaved())
  const [draftTeams, setDraftTeams] = useState(() => defaultTeamsMapDraftFromSaved(defaultTeamsMapSaved()))
  const [hydrated, setHydrated] = useState(false)
  const [remotePush, setRemotePush] = useState({ status: 'idle', message: null })
  const readyToPushRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let raw = null
      if (isCompetenciaManualRemoteEnabled()) {
        try {
          const snap = await fetchCompetenciaManualRemote()
          if (snap?.teamRaw) {
            raw = snap.teamRaw
            applyRemoteManualCache({ teamRaw: snap.teamRaw })
            if (snap.teamRaw?.teams) writeTeamManualLocal(snap.teamRaw.teams)
          }
        } catch {
          /* fallback local */
        }
      }
      if (!raw) {
        try {
          raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        } catch {
          raw = null
        }
      }

      const normalized = normalizeLoaded(raw)
      if (!cancelled) {
        setSavedTeams(normalized)
        setDraftTeams(defaultTeamsMapDraftFromSaved(normalized))
        setHydrated(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const payload = { version: 1, teams: savedTeams }
    writeTeamManualLocal(savedTeams)
    notifyCompetenciaManualUpdated()

    if (!readyToPushRef.current) {
      readyToPushRef.current = true
      return
    }

    if (isCompetenciaManualRemoteEnabled()) {
      pushCompetenciaManualRemote('team', payload).then((result) => {
        if (!result.ok) {
          setRemotePush({
            status: 'error',
            message: remotePushReasonMessage(result.reason),
          })
          return
        }
        setRemotePush({ status: 'ok', message: null })
      })
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
          promesasCount: 0,
          escriturasCount: 0,
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
          promesasCount: 0,
          escriturasCount: 0,
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
    remotePush,
  }
}
