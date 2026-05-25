import { useState, useEffect, useCallback } from 'react'
import mockData from '../data/reservas_mock.json'
import { fetchReservasOred } from '../api/oredClient'
import { mapReservaRow, mapReservaPublica } from '../utils/mapReserva'

const DATA_SOURCE = (
  import.meta.env.VITE_DATA_SOURCE || 'ored'
).trim().toLowerCase()

export function useReservas() {
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isLive, setIsLive] = useState(false)

  const load = useCallback(async (signal) => {
    try {
      setLoading(true)
      setError(null)

      if (DATA_SOURCE === 'mock') {
        setReservas(mockData.map(mapReservaRow).filter((r) => r && r.id))
        setLastUpdated(new Date())
        return
      }

      const resp = await fetchReservasOred({ signal })
      const mapped = (resp.reservas || []).map(mapReservaPublica).filter((r) => r && r.id)
      setReservas(mapped)
      setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
      setIsLive(true)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || String(err))
      setReservas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load])

  return { reservas, loading, error, lastUpdated, refetch: () => load(), isLive }
}
