import { useState } from 'react'
import { CloudUpload, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  isCompetenciaManualRemoteEnabled,
  publishAllCompetenciaManualToRemote,
  remotePushReasonMessage,
} from '../api/competenciaManualRemote.js'
import styles from './CompetenciaRemoteSyncBanner.module.css'

/**
 * Avisos de sync con Supabase para que /cyber refleje promesas/escrituras.
 * @param {Object} props
 * @param {boolean} props.canEdit
 * @param {boolean} props.hasSession
 * @param {{ status: string, message?: string | null }} [props.remotePush]
 */
export default function CompetenciaRemoteSyncBanner({ canEdit, hasSession, remotePush }) {
  const remoteEnabled = isCompetenciaManualRemoteEnabled()
  const [publishState, setPublishState] = useState({ status: 'idle', message: null })

  if (!remoteEnabled) return null

  const pushError =
    remotePush?.status === 'error' && remotePush.message ? remotePush.message : null
  const publishError =
    publishState.status === 'error' && publishState.message ? publishState.message : null
  const showLoginHint = !hasSession

  async function handlePublishAll() {
    if (!canEdit || !hasSession) return
    setPublishState({ status: 'loading', message: null })
    const result = await publishAllCompetenciaManualToRemote()
    if (!result.ok) {
      setPublishState({
        status: 'error',
        message: remotePushReasonMessage(result.reason),
      })
      return
    }
    setPublishState({
      status: 'ok',
      message: 'Publicado. Visible en /cyber en unos segundos.',
    })
  }

  return (
    <div className={styles.wrap} role="status">
      {showLoginHint && (
        <p className={styles.warn}>
          <AlertTriangle size={16} aria-hidden />
          Inicia sesión para que los puntos guardados lleguen al ranking público (/cyber).
        </p>
      )}

      {pushError && (
        <p className={styles.error}>
          <AlertTriangle size={16} aria-hidden />
          {pushError}
        </p>
      )}

      {publishError && (
        <p className={styles.error}>
          <AlertTriangle size={16} aria-hidden />
          {publishError}
        </p>
      )}

      {(remotePush?.status === 'ok' || publishState.status === 'ok') && (
        <p className={styles.ok}>
          <CheckCircle2 size={16} aria-hidden />
          {publishState.message ?? 'Cambios publicados en /cyber.'}
        </p>
      )}

      {canEdit && hasSession && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={handlePublishAll}
            disabled={publishState.status === 'loading'}
          >
            <CloudUpload size={16} aria-hidden />
            {publishState.status === 'loading' ? 'Publicando…' : 'Publicar todo en /cyber'}
          </button>
          <span className={styles.hint}>
            Tras guardar un asesor, se publica solo. Usa este botón si migras datos locales.
          </span>
        </div>
      )}
    </div>
  )
}
