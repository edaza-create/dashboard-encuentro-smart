import { useState, useEffect, useCallback } from 'react'
import mockData from '../data/reservas_mock.json'
import { atlasProxyConfigured, fetchReservasAtlas } from '../api/atlasClient.js'
import { fetchReservasRanking } from '../api/rankingClient.js'
import { fetchReservasPrivado, reservasPrivadoConfigured } from '../api/reservasPrivadoClient.js'
import { dedupeReservasPorEvento } from '../utils/dedupeReservas.js'
import { supabase, supabaseConfigured } from '../data/supabaseClient'
import { mapReservaRow, mapReservaAtlas, mapReservaPublica } from '../utils/mapReserva'

const TABLE =
  import.meta.env.SUPABASE_RESERVAS_TABLE ||
  import.meta.env.VITE_SUPABASE_RESERVAS_TABLE ||
  'reservas'

/**
 * Fuente por defecto: Atlas Engine.
 *
 * Decision del negocio: los datos de reservas se toman de Atlas. ored queda
 * reservado unicamente para las fotos de los asesores en el ranking publico.
 *
 * Ojo al comparar cifras: en la ventana Cyber Atlas ve 475 reservas y marca 71
 * caidas, mientras ored ve 416 y marca 84. Las caidas se descuentan igual en
 * ambos casos, pero cada fuente tiene su propia vision de cuales son.
 *
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

      // Proxy autenticado: mismas reservas + contacto del cliente. Requiere
      // sesion; ante 401/403 se sigue con el proxy publico, sin datos de cliente.
      if (reservasPrivadoConfigured()) {
        try {
          const resp = await fetchReservasPrivado()
          const mapped = dedupeReservasPorEvento(
            (resp.reservas || []).map(mapReservaPublica).filter((r) => r && r.id)
          )
          setReservas(mapped)
          setDataSource(resp.origen ?? 'privado')
          setIsLive(false)
          setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
          return
        } catch (privErr) {
          console.info('[useReservas] sin datos de cliente:', privErr.message)
        }
      }

      if (DATA_SOURCE === 'atlas') {
        if (!atlasProxyConfigured()) {
          throw new Error(
            'Atlas no configurado: falta SUPABASE_URL o VITE_ATLAS_PROXY_URL. ' +
              'Ver docs/DEPLOY-reservas-atlas.md'
          )
        }
        // Sin fallback silencioso a ored: las dos fuentes clasifican distinto y
        // mezclarlas daria cifras que no cuadran con la fuente elegida.
        const resp = await fetchReservasAtlas()
        const mapped = dedupeReservasPorEvento(
          (resp.reservas || []).map(mapReservaAtlas).filter((r) => r && r.id)
        )
        setReservas(mapped)
        setDataSource('atlas')
        setIsLive(false)
        setLastUpdated(resp.updated_at ? new Date(resp.updated_at) : new Date())
        return
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
