import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  fetchCompetenciaManualRemote,
  isCompetenciaManualRemoteEnabled,
  pushCompetenciaManualRemote,
  remotePushReasonMessage,
} from '../api/competenciaManualRemote.js'
import {
  COMPETENCIA_INDIVIDUAL_STORAGE_KEY as STORAGE_KEY,
  applyRemoteManualCache,
  notifyCompetenciaManualUpdated,
  writeIndividualManualLocal,
} from '../utils/competenciaStorage.js'

/**
 * `reservasOverride`: null = usar el conteo automatico de la API. Un numero fija
 * la cantidad de reservas del asesor, para corregir a mano cuando la fuente de
 * datos no cuadra con la realidad del negocio.
 */
function defaultEntry() {
  return { promesasCount: 0, escriturasCount: 0, reservasOverride: null }
}

/** null si no hay ajuste; si lo hay, un entero acotado. */
export function normalizeReservasOverride(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(9999, Math.floor(n)))
}

function migrateKey(k) {
  // Normalize accents in n:… keys so old entries (e.g. "n:sebastián") merge
  // with their normalized counterpart ("n:sebastian") after the asesorStorageKey fix.
  if (!k.startsWith('n:')) return k
  return 'n:' + k.slice(2).normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeLoaded(raw) {
  const asesores = raw?.asesores
  if (!asesores || typeof asesores !== 'object') return {}
  const out = {}
  for (const id of Object.keys(asesores)) {
    const t = asesores[id]
    if (!t || typeof t !== 'object') continue
    const key = migrateKey(id)
    const promesas = Math.max(0, Math.min(9999, Math.floor(Number(t.promesasCount) || 0)))
    const escrituras = Math.max(0, Math.min(9999, Math.floor(Number(t.escriturasCount) || 0)))
    const override = normalizeReservasOverride(t.reservasOverride)
    if (out[key]) {
      // Two old keys collapsed into same normalized key → keep the higher value
      out[key].promesasCount = Math.max(out[key].promesasCount, promesas)
      out[key].escriturasCount = Math.max(out[key].escriturasCount, escrituras)
      // Un ajuste manual explicito gana sobre la ausencia de ajuste.
      if (override !== null) {
        out[key].reservasOverride =
          out[key].reservasOverride === null
            ? override
            : Math.max(out[key].reservasOverride, override)
      }
    } else {
      out[key] = {
        promesasCount: promesas,
        escriturasCount: escrituras,
        reservasOverride: override,
      }
    }
  }
  return out
}

function entryEquals(a, b) {
  if (!a || !b) return false
  return (
    a.promesasCount === b.promesasCount &&
    a.escriturasCount === b.escriturasCount &&
    (a.reservasOverride ?? null) === (b.reservasOverride ?? null)
  )
}

function mergeKeys(saved, draft, keys) {
  const ns = { ...saved }
  const nd = { ...draft }
  for (const k of keys) {
    if (!(k in ns)) ns[k] = defaultEntry()
    if (!(k in nd)) nd[k] = { ...ns[k] }
  }
  return { saved: ns, draft: nd }
}

const initial = { saved: {}, draft: {}, hydrated: false }

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate': {
      const saved = normalizeLoaded(action.raw)
      const draft = {}
      for (const k of Object.keys(saved)) {
        draft[k] = { ...saved[k] }
      }
      return { ...state, saved, draft, hydrated: true }
    }
    case 'mergeKeys': {
      const { saved, draft } = mergeKeys(state.saved, state.draft, action.keys)
      return { ...state, saved, draft }
    }
    case 'patchDraft': {
      const k = action.key
      return {
        ...state,
        draft: {
          ...state.draft,
          [k]: { ...(state.draft[k] || defaultEntry()), ...action.patch },
        },
      }
    }
    case 'saveAsesor': {
      const k = action.key
      const snapshot = { ...(state.draft[k] || defaultEntry()) }
      return {
        ...state,
        saved: { ...state.saved, [k]: snapshot },
      }
    }
    case 'resetAll':
      return { ...state, saved: {}, draft: {} }
    default:
      return state
  }
}

export function useCompetenciaIndividualManual(asesorKeys) {
  const [state, dispatch] = useReducer(reducer, initial)
  const [remotePush, setRemotePush] = useState({ status: 'idle', message: null })
  const keysStr = [...asesorKeys].sort().join('|')
  const readyToPushRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      let raw = null
      if (isCompetenciaManualRemoteEnabled()) {
        try {
          const snap = await fetchCompetenciaManualRemote()
          if (snap?.individualRaw) {
            raw = snap.individualRaw
            applyRemoteManualCache({ individualRaw: snap.individualRaw })
            if (snap.individualRaw?.asesores) {
              writeIndividualManualLocal(snap.individualRaw.asesores)
            }
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
      if (!cancelled) {
        dispatch({ type: 'hydrate', raw })
      }
    }

    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.hydrated || !asesorKeys.length) return
    dispatch({ type: 'mergeKeys', keys: asesorKeys })
  }, [keysStr, state.hydrated])

  useEffect(() => {
    if (!state.hydrated) return
    const payload = { version: 1, asesores: state.saved }
    writeIndividualManualLocal(state.saved)
    notifyCompetenciaManualUpdated()

    if (!readyToPushRef.current) {
      readyToPushRef.current = true
      return
    }

    if (isCompetenciaManualRemoteEnabled()) {
      pushCompetenciaManualRemote('individual', payload).then((result) => {
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
  }, [state.saved, state.hydrated])

  const patchDraft = useCallback((key, patch) => {
    dispatch({ type: 'patchDraft', key: String(key), patch })
  }, [])

  const saveAsesor = useCallback((key) => {
    dispatch({ type: 'saveAsesor', key: String(key) })
  }, [])

  const resetAll = useCallback(() => {
    dispatch({ type: 'resetAll' })
  }, [])

  const isDirty = useCallback(
    (key) => {
      const k = String(key)
      return !entryEquals(state.draft[k] || defaultEntry(), state.saved[k] || defaultEntry())
    },
    [state.draft, state.saved]
  )

  return {
    saved: state.saved,
    draft: state.draft,
    patchDraft,
    saveAsesor,
    resetAll,
    hydrated: state.hydrated,
    isDirty,
    remotePush,
  }
}
