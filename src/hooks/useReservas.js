import { useState, useEffect, useCallback } from 'react'
import mockData from '../data/reservas_mock.json'
import { supabase, supabaseConfigured } from '../data/supabaseClient'
import { mapReservaRow } from '../utils/mapReserva'

const TABLE =
  import.meta.env.SUPABASE_RESERVAS_TABLE ||
  import.meta.env.VITE_SUPABASE_RESERVAS_TABLE ||
  'reservas'

export function useReservas() {
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isLive, setIsLive] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!supabaseConfigured || !supabase) {
        await new Promise((r) => setTimeout(r, 200))
        setReservas(mockData.map(mapReservaRow).filter((r) => r && r.id))
        setLastUpdated(new Date())
        setLoading(false)
        return
      }

      const { data, error: qErr } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })

      if (qErr) throw qErr

      const mapped = (data || []).map(mapReservaRow).filter((r) => r && r.id)
      setReservas(mapped)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || String(err))
      setReservas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setIsLive(false)
      return undefined
    }

    const channel = supabase
      .channel(`dashboard-reservas:${TABLE}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        () => {
          load()
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      setIsLive(false)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { reservas, loading, error, lastUpdated, refetch: load, isLive }
}
