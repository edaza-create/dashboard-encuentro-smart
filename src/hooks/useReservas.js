import { useState, useEffect, useCallback } from 'react'
import mockData from '../data/reservas_mock.json'
import { atlasProxyConfigured, fetchReservasAtlas } from '../api/atlasClient.js'
import { fetchReservasRanking } from '../api/rankingClient.js'
import { fetchReservasPrivado, reservasPrivadoConfigured } from '../api/reservasPrivadoClient.js'
import { supabase, supabaseConfigured } from '../data/supabaseClient'
import { mapReservaRow, mapReservaAtlas, mapReservaPublica } from '../utils/mapReserva'

const TABLE =
  import.meta.env.SUPABASE_RESERVAS_TABLE ||
  import.meta.env.VITE_SUPABASE_RESERVAS_TABLE ||
  'reservas'

/**
 * Fuente por defecto: Atlas Engine, la unica que informa si una reserva se cayo.
 * Si el proxy no esta configurado se cae a ored (sin estado de reserva).
 * @type {'atlas' | 'ored' | 'supabase' | 'mock'}
 */
const DATA_SOURCE =
  import.meta.env.VITE_DATA_SOURCE === 'supabase'
    ? 'supabase'
    : import.meta.env.VITE_DATA_SOURCE === 'mock'
      ? 'mock'
      : import.meta.env.VITE_DATA_SOURCE === 'ored'
        ? 'ored'
        : 'atlas'

/** 0 = sin auto-refresh (solo carga inicial + botón Actualizar). */
function readDashboardPollMs() {
  const raw = import.meta.env.VITE_DASHBOARD_POLL_MS
  if (raw == null || raw === '' || raw === '0' || raw === 'false') return 0
  const n = Number(raw)
  return Number.isFinite(n) && n >= 5_000 ? n : 0
}

export function useReservas() {
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [dataSource, setDataSource] = useState(DATA_SOURCE)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (DATA_SOURCE === 'mock') {
        await new Promise((r) => setTimeout(r, 200))
        setReservas(mockData.map(mapReservaRow).filter((r) => r && r.id))
        setDataSource('mock')
        setIsLive(false)
        setLastUpdated(new Date())
        return
      }

      if (DATA_SOURCE === 'supabase') {
        if (!supabaseConfigured || !supabase) {
          setReservas(mockData.map(mapReservaRow).filter((r) => r && r.id))
          setDataSource('mock')
          setIsLive(false)
          setLastUpdated(new Date())
          return
        }

        const { data, error: qErr } = await supabase
          .from(TABLE)
          .select('*')
          .order('created_at', { ascending: false })

        if (qErr) {
          console.warn('[useReservas] Supabase table error, falling back to ored:', qErr.message)
        } else {
          const mapped = (data || []).map(mapReservaRow).filter((r) => r && r.id)
          setReservas(mapped)
          setDataSource('supabase')
          setLastUpdated(new Date())
          return
        }
      }

      if (DATA_SOURCE === 'atlas' && atlasProxyConfigured()) {
        try {
          const resp = await fetchReservasAtlas()
          const mapped = (resp.reservas || []).map(mapReservaAtlas).filter((r) => r && r.id)
          setReservas(mapped)
          setDataSource('atlas')
          setIsLive(false)
          setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
          return
        } catch (atlasErr) {
          console.warn('[useReservas] Atlas no disponible, usando ored:', atlasErr.message)
        }
      }

      // Endpoint privado: mismos datos + contacto del cliente. Solo responde a
      // administradores con sesion; ante 401/403 se sigue con el publico.
      if (reservasPrivadoConfigured()) {
        try {
          const resp = await fetchReservasPrivado()
          const mapped = (resp.reservas || []).map(mapReservaPublica).filter((r) => r && r.id)
          setReservas(mapped)
          setDataSource('ored-privado')
          setIsLive(false)
          setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
          return
        } catch (privErr) {
          console.info('[useReservas] sin datos de cliente, usando endpoint publico:', privErr.message)
        }
      }

      const resp = await fetchReservasRanking()
      const mapped = (resp.reservas || []).map(mapReservaPublica).filter((r) => r && r.id)
      setReservas(mapped)
      setDataSource('ored')
      setIsLive(false)
      setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
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
    if (DATA_SOURCE === 'supabase' && supabaseConfigured && supabase) {
      const channel = supabase
        .channel(`dashboard-reservas:${TABLE}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
          load()
        })
        .subscribe((status) => {
          setIsLive(status === 'SUBSCRIBED')
        })

      return () => {
        setIsLive(false)
        supabase.removeChannel(channel)
      }
    }

    if (DATA_SOURCE === 'ored' || DATA_SOURCE === 'atlas') {
      const pollMs = readDashboardPollMs()
      if (pollMs > 0) {
        const id = setInterval(load, pollMs)
        return () => clearInterval(id)
      }
      return undefined
    }

    setIsLive(false)
    return undefined
  }, [load])

  return { reservas, loading, error, lastUpdated, refetch: load, isLive, dataSource }
}
