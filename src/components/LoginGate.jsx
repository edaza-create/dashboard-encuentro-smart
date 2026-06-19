import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured } from '../data/supabaseClient'
import { adminEmailsSet } from '../config/admins'
import styles from './LoginGate.module.css'

export default function LoginGate({ children }) {
  const { session, loading, signInWithOtp, verifyOtp } = useAuth()

  // Sin Supabase configurado (dev local) se salta el gate
  if (!supabaseConfigured) return children
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false)

  if (loading) {
    return (
      <div className={styles.backdrop}>
        <span className={styles.loading}>Cargando sesion...</span>
      </div>
    )
  }

  if (session) return children

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setMsg('')
    setIsError(false)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setMsg('Ingresa tu correo.')
      setIsError(true)
      return
    }
    if (adminEmailsSet.size > 0 && !adminEmailsSet.has(trimmed)) {
      setMsg('Correo no autorizado.')
      setIsError(true)
      return
    }
    setSending(true)
    const { error } = await signInWithOtp(trimmed)
    setSending(false)
    if (error) {
      setMsg(error.message || 'No se pudo enviar el codigo.')
      setIsError(true)
      return
    }
    setStep('code')
    setMsg('Revisa tu correo e ingresa el codigo de 6 digitos.')
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setMsg('')
    setIsError(false)
    const trimmed = token.trim()
    if (!trimmed) {
      setMsg('Ingresa el codigo.')
      setIsError(true)
      return
    }
    setSending(true)
    const { error } = await verifyOtp(email.trim(), trimmed)
    setSending(false)
    if (error) {
      setMsg(error.message || 'Codigo incorrecto o expirado.')
      setIsError(true)
      return
    }
  }

  const handleBack = () => {
    setStep('email')
    setToken('')
    setMsg('')
    setIsError(false)
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.title}>Dashboard Capital Open</h1>

        {step === 'email' && (
          <>
            <p className={styles.subtitle}>Ingresa tu correo para recibir un codigo de acceso</p>
            <form className={styles.form} onSubmit={handleSendOtp}>
              <input
                type="email"
                className={styles.input}
                placeholder="correo@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
              <button type="submit" className={styles.btn} disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar codigo'}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className={styles.subtitle}>Codigo enviado a <strong>{email}</strong></p>
            <form className={styles.form} onSubmit={handleVerify}>
              <input
                type="text"
                className={styles.input}
                placeholder="123456"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                autoFocus
              />
              <button type="submit" className={styles.btn} disabled={sending}>
                {sending ? 'Verificando...' : 'Verificar'}
              </button>
              <button type="button" className={styles.btnLink} onClick={handleBack}>
                Cambiar correo
              </button>
            </form>
          </>
        )}

        {msg && <span className={`${styles.msg} ${isError ? styles.msgError : ''}`}>{msg}</span>}
      </div>
    </div>
  )
}
