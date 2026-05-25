import { useState, useEffect, useCallback } from 'react'
import { fetchReuniones } from '../api/reunionesAdmin.js'
import { deriveEstado } from '../api/asistenciaRegistros.js'

const POLL_MS = 15_000

/**
 * Lista de reuniones con polling y estado derivado.
 * @returns {{ reuniones: Array, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useReunionesAdmin() {
  const [reuniones, setReuniones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const pull = useCallback(async (signal) => {
    try {
      const rows = await fetchReuniones(signal)
      const enriched = rows.map((r) => ({ ...r, estado: deriveEstado(r) }))
      setReuniones(enriched)
      setError(null)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    pull(ac.signal)

    const hasActiva = () => reuniones.some((r) => r.estado === 'activa')
    const id = setInterval(() => {
      if (hasActiva()) pull(ac.signal)
    }, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') pull(ac.signal)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      ac.abort()
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pull])

  const refetch = useCallback(() => pull(), [pull])

  return { reuniones, loading, error, refetch }
}
