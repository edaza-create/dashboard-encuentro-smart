import { useState } from 'react'
import { LogIn, LogOut, Mail } from 'lucide-react'
import { supabaseConfigured } from '../data/supabaseClient'
import { adminEmailsSet } from '../config/admins'
import { useAuth } from '../context/AuthContext'
import styles from './LoginControls.module.css'

export default function LoginControls() {
  const { session, loading, canEditCompetencia, adminLockActive, signInWithOtp, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  if (adminEmailsSet.size === 0) return null

  if (!supabaseConfigured) {
    return (
      <div className={styles.hint} role="status">
        <span className={styles.hintWarn}>
          Hay <code>VITE_ADMIN_EMAILS</code> pero falta Supabase: no se puede restringir por sesión.
        </span>
      </div>
    )
  }

  const userEmail = session?.user?.email?.trim()
  const isLoggedIn = Boolean(userEmail)

  const handleSendLink = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!email.trim()) {
      setMsg('Ingresa tu correo.')
      return
    }
    setSending(true)
    const { error } = await signInWithOtp(email)
    setSending(false)
    if (error) {
      setMsg(error.message || 'No se pudo enviar el enlace.')
      return
    }
    setMsg('Revisa tu correo y abre el enlace para entrar.')
  }

  if (loading) {
    return <div className={styles.hint}>Sesión…</div>
  }

  if (isLoggedIn) {
    const readOnlyUser = adminLockActive && !canEditCompetencia
    return (
      <div className={styles.row}>
        <span className={styles.user} title={userEmail}>
          <Mail size={14} aria-hidden />
          <span className={styles.userEmail}>{userEmail}</span>
          {readOnlyUser && <span className={styles.badgeRo}>Solo lectura</span>}
          {adminLockActive && canEditCompetencia && <span className={styles.badgeAdm}>Admin</span>}
        </span>
        <button type="button" className={styles.outBtn} onClick={() => signOut()} aria-label="Cerrar sesión">
          <LogOut size={16} aria-hidden />
          Salir
        </button>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSendLink}>
      <span className={styles.formLabel}>Competencia:</span>
      <input
        type="email"
        className={styles.input}
        placeholder="correo@empresa.cl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        aria-label="Correo para enlace de acceso"
      />
      <button type="submit" className={styles.inBtn} disabled={sending}>
        <LogIn size={16} aria-hidden />
        {sending ? 'Enviando…' : 'Enlace'}
      </button>
      {msg && <span className={styles.msg}>{msg}</span>}
    </form>
  )
}
