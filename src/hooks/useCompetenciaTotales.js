import { useEffect, useMemo, useState } from 'react'
import { computeCompetenciaTotales } from '../utils/competenciaTotales'
import { subscribeCompetenciaManualUpdated } from '../utils/competenciaStorage'

/**
 * Totales de competencia; se recalcula al cambiar reservas o puntos manuales guardados.
 */
export function useCompetenciaTotales(reservas) {
  const [manualVersion, setManualVersion] = useState(0)

  useEffect(() => {
    return subscribeCompetenciaManualUpdated(() => setManualVersion((v) => v + 1))
  }, [])

  return useMemo(
    () => computeCompetenciaTotales(reservas),
    [reservas, manualVersion]
  )
}
