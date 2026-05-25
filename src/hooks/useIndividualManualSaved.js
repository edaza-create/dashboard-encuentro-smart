import { useEffect, useMemo, useState } from 'react'
import { loadIndividualManualSaved, subscribeCompetenciaManualUpdated } from '../utils/competenciaStorage'

/** Puntos manuales por asesor; se refresca al guardar en competencia individual. */
export function useIndividualManualSaved() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return subscribeCompetenciaManualUpdated(() => setVersion((v) => v + 1))
  }, [])

  return useMemo(() => loadIndividualManualSaved(), [version])
}
