import { useCallback, useEffect, useReducer } from 'react'

const STORAGE_KEY = 'capital-open-competencia-individual-v1'

function defaultEntry() {
  return { promesasCount: 0, escriturasCount: 0 }
}

function normalizeLoaded(raw) {
  const asesores = raw?.asesores
  if (!asesores || typeof asesores !== 'object') return {}
  const out = {}
  for (const id of Object.keys(asesores)) {
    const t = asesores[id]
    if (!t || typeof t !== 'object') continue
    out[id] = {
      promesasCount: Math.max(0, Math.min(9999, Math.floor(Number(t.promesasCount) || 0))),
      escriturasCount: Math.max(0, Math.min(9999, Math.floor(Number(t.escriturasCount) || 0))),
    }
  }
  return out
}

function entryEquals(a, b) {
  if (!a || !b) return false
  return a.promesasCount === b.promesasCount && a.escriturasCount === b.escriturasCount
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
  const keysStr = [...asesorKeys].sort().join('|')

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      dispatch({ type: 'hydrate', raw })
    } catch {
      dispatch({ type: 'hydrate', raw: null })
    }
  }, [])

  useEffect(() => {
    if (!state.hydrated || !asesorKeys.length) return
    dispatch({ type: 'mergeKeys', keys: asesorKeys })
  }, [keysStr, state.hydrated])

  useEffect(() => {
    if (!state.hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, asesores: state.saved }))
    } catch {
      /* ignore */
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
  }
}
