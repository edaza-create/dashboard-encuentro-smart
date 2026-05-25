import { useState, useEffect, useCallback } from 'react'
import { fetchConteosPorReunion, fetchRegistrosPorReunion } from '../api/asistenciaRegistros.js'

const POLL_MS = 15_000

/**
 * Polling de conteos y registros para una reunión activa.
 * @param {string|null} reunionId
 * @param {{ includeRegistros?: boolean }} [opts]
 * @returns {{ conteos: Array, registros: Array, totalAsistentes: number, loading: boolean, refetch: () => void }}
 */
export function useReunionEnVivo(reunionId, opts = {}) {
  const [conteos, setConteos] = useState([])
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)

  const pull = useCallback(async (signal) => {
    if (!reunionId) return
    try {
      const [c, r] = await Promise.all([
        fetchConteosPorReunion(reunionId, signal),
        opts.includeRegistros ? fetchRegistrosPorReunion(reunionId, signal) : Promise.resolve(null),
      ])
      setConteos(c)
      if (r !== null) setRegistros(r)
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[useReunionEnVivo]', e)
    } finally {
      setLoading(false)
    }
  }, [reunionId, opts.includeRegistros])

  useEffect(() => {
    if (!reunionId) { setLoading(false); return }
    const ac = new AbortController()
    pull(ac.signal)
    const id = setInterval(() => pull(ac.signal), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pull(ac.signal)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ac.abort()
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reunionId, pull])

  const totalAsistentes = conteos.reduce((sum, c) => sum + Number(c.total), 0)
  const refetch = useCallback(() => pull(), [pull])

  return { conteos, registros, totalAsistentes, loading, refetch }
}
