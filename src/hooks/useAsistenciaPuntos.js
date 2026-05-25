import { useState, useEffect, useCallback } from 'react'
import { fetchConteosGlobal } from '../api/asistenciaRegistros'
import { buildAsistenciaPuntos } from '../utils/buildAsistenciaPuntos'
import { rosterEmailsPorEquipoCapitalOpen } from '../utils/asesorMaestra'

const rosterMap = rosterEmailsPorEquipoCapitalOpen()

export function useAsistenciaPuntos() {
  const [puntos, setPuntos] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (signal) => {
    try {
      setLoading(true)
      const conteos = await fetchConteosGlobal(signal)
      setPuntos(buildAsistenciaPuntos(conteos, rosterMap))
    } catch (err) {
      if (err.name === 'AbortError') return
      setPuntos({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load])

  return { asistenciaPuntos: puntos, loading, refetch: () => load() }
}
