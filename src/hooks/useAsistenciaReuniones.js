import { useCallback, useEffect, useState } from 'react'
import { fetchAsistenciaReuniones, isAsistenciaRemoteEnabled } from '../api/asistenciaRemote.js'
import { subscribeCompetenciaManualUpdated } from '../utils/competenciaStorage.js'

const DEFAULT_POLL_MS = 30_000

function readPollMs() {
  const raw = import.meta.env.VITE_ASISTENCIA_POLL_MS
  if (raw == null || raw === '') return DEFAULT_POLL_MS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 10_000 ? n : DEFAULT_POLL_MS
}

/**
 * Asistencias Google Forms + premios de actividad otorgados.
 */
export function useAsistenciaReuniones() {
  const enabled = isAsistenciaRemoteEnabled()
  const [state, setState] = useState({
    status: enabled ? 'loading' : 'disabled',
    error: null,
    rows: [],
    awards: [],
    lastSync: null,
  })

  const load = useCallback(async () => {
    if (!enabled) {
      setState((s) => ({ ...s, status: 'disabled', error: null }))
      return
    }
    try {
      const { rows, awards } = await fetchAsistenciaReuniones()
      setState({
        status: 'ready',
        error: null,
        rows,
        awards,
        lastSync: Date.now(),
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: err?.message ?? String(err),
      }))
    }
  }, [enabled])

  useEffect(() => {
    load()
    if (!enabled) return undefined

    const pollMs = readPollMs()
    const timer = setInterval(load, pollMs)
    const unsub = subscribeCompetenciaManualUpdated(load)

    return () => {
      clearInterval(timer)
      unsub()
    }
  }, [enabled, load])

  return { ...state, enabled, refetch: load }
}
