import { useState, useEffect } from 'react'
import { fetchReunionPublica, deriveEstado, insertAsistencia } from '../api/asistenciaRegistros.js'
import { resolveAsesorMaestra } from '../utils/asesorMaestra.js'
import { supabase } from '../data/supabaseClient.js'
import { useCountdown } from '../hooks/useCountdown.js'
import styles from './AsistenciaFormPage.module.css'

function getReunionId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('reunion')
}

const VALID_DOMAINS = ['@capitalinteligente.cl', '@capitalinteligente.me']

export default function AsistenciaFormPage() {
  const reunionId = getReunionId()
  const [reunion, setReunion] = useState(null)
  const [estado, setEstado] = useState(null)
  const [loadingReunion, setLoadingReunion] = useState(true)

  const [email, setEmail] = useState('')
  const [modalidad, setModalidad] = useState('Presencial')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const countdown = useCountdown(reunion?.closes_at)

  useEffect(() => {
    if (!reunionId) { setLoadingReunion(false); return }
    fetchReunionPublica(reunionId).then((r) => {
      setReunion(r)
      if (r) setEstado(deriveEstado(r))
      setLoadingReunion(false)
    })
  }, [reunionId])

  useEffect(() => {
    if (countdown.expired && estado === 'activa') {
      setEstado('cerrada')
    }
  }, [countdown.expired, estado])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    const trimmed = email.trim().toLowerCase()
    if (!VALID_DOMAINS.some((d) => trimmed.endsWith(d))) {
      setError(`Solo se aceptan emails ${VALID_DOMAINS.join(' o ')}`)
      return
    }

    const asesor = resolveAsesorMaestra(trimmed)

    let nombre = asesor.ok ? asesor.nombre : null
    let bp_slug = asesor.ok ? asesor.bp_slug : null
    let equipo_id = asesor.ok && asesor.equipo_id ? Number(asesor.equipo_id) : null
    let equipo_label = asesor.ok ? asesor.equipo : null

    if (!asesor.ok) {
      if (!supabase) {
        setError('Email no encontrado en el registro de asesores activos')
        return
      }
      const { data: member } = await supabase
        .from('panel_members')
        .select('name, company')
        .eq('email', trimmed)
        .eq('is_active', true)
        .maybeSingle()
      if (!member) {
        setError('Email no encontrado en el registro de asesores activos')
        return
      }
      nombre = member.name
      bp_slug = member.company ?? 'panel-member'
    }

    setSubmitting(true)
    const res = await insertAsistencia({
      reunion_id: reunionId,
      email: trimmed,
      nombre,
      bp_slug,
      equipo_id,
      equipo_label,
      modalidad,
    })
    setSubmitting(false)

    if (!res.ok) {
      if (res.reason === 'duplicate') {
        setResult({ type: 'duplicate', nombre })
      } else {
        setError(res.reason)
      }
      return
    }

    setResult({ type: 'success', nombre, equipo: equipo_label, modalidad })
  }

  if (loadingReunion) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <p className={styles.loading}>Cargando reunión...</p>
        </div>
      </div>
    )
  }

  if (!reunionId || !reunion) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reunión no encontrada</h1>
          <p className={styles.subtitle}>El enlace no es válido o la reunión fue eliminada.</p>
        </div>
      </div>
    )
  }

  if (estado !== 'activa') {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <div className={styles.statusIcon}>🔴</div>
          <h1 className={styles.title}>{reunion.nombre}</h1>
          <p className={styles.subtitle}>
            {estado === 'borrador'
              ? 'Esta reunión aún no ha sido activada.'
              : 'Esta reunión ya cerró y no acepta más registros.'}
          </p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <div className={styles.statusIcon}>
            {result.type === 'duplicate' ? '✅' : '🎉'}
          </div>
          <h1 className={styles.title}>
            {result.type === 'duplicate' ? 'Ya registrado' : '¡Asistencia registrada!'}
          </h1>
          <p className={styles.subtitle}>
            {result.type === 'duplicate'
              ? `${result.nombre ?? 'Tu asistencia'} ya fue registrada en esta reunión.`
              : `${result.nombre ?? 'Asistencia'} — ${result.modalidad} — ${result.equipo ?? ''}`}
          </p>
          <p className={styles.reunionName}>{reunion.nombre}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.liveIndicator}>EN VIVO</span>
          <span className={styles.countdown}>{countdown.remaining}</span>
        </div>

        <h1 className={styles.title}>{reunion.nombre}</h1>
        <p className={styles.subtitle}>Registra tu asistencia</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email corporativo
            <input
              className={styles.input}
              type="email"
              placeholder="tu.nombre@capitalinteligente.cl/.me"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              inputMode="email"
            />
          </label>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Modalidad</legend>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggle} ${modalidad === 'Presencial' ? styles.toggleActive : ''}`}
                onClick={() => setModalidad('Presencial')}
              >
                🏢 Presencial
              </button>
              <button
                type="button"
                className={`${styles.toggle} ${modalidad === 'Online' ? styles.toggleActive : ''}`}
                onClick={() => setModalidad('Online')}
              >
                🖥 Online
              </button>
            </div>
          </fieldset>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !email.trim()}
          >
            {submitting ? 'Registrando...' : 'Registrar asistencia'}
          </button>
        </form>
      </div>
    </div>
  )
}
