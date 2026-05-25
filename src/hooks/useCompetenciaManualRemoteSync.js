import { useEffect } from 'react'
import { fetchCompetenciaManualRemote, isCompetenciaManualRemoteEnabled } from '../api/competenciaManualRemote.js'
import { applyRemoteManualCache } from '../utils/competenciaStorage.js'

const DEFAULT_MANUAL_POLL_MS = 15_000

function readManualPollMs() {
  const raw = import.meta.env.VITE_CYBER_MANUAL_POLL_MS
  if (raw == null || raw === '') return DEFAULT_MANUAL_POLL_MS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_MANUAL_POLL_MS
}

/**
 * Sincroniza puntos manuales desde Supabase (lectura pública con anon).
 * Necesario para que /cyber refleje cambios sin tener el dashboard abierto en el mismo navegador.
 */
export function useCompetenciaManualRemoteSync() {
  const enabled = isCompetenciaManualRemoteEnabled()

  useEffect(() => {
    if (!enabled) return undefined

    const ac = new AbortController()

    const pull = () => {
      fetchCompetenciaManualRemote(ac.signal)
        .then((snap) => {
          if (!snap) return
          applyRemoteManualCache({
            individualRaw: snap.individualRaw,
            teamRaw: snap.teamRaw,
          })
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          // eslint-disable-next-line no-console
          console.warn('[competencia-manual] sync remoto:', err.message ?? err)
        })
    }

    pull()

    const pollMs = readManualPollMs()
    const timer = setInterval(pull, pollMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') pull()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      ac.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])

  return { enabled, pollIntervalMs: readManualPollMs() }
}
