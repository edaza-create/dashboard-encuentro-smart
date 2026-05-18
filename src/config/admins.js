import { supabaseConfigured } from '../data/supabaseClient'

/**
 * Correos con permiso de edición en competencia (Capital Open equipos / individual).
 * En `.env`: VITE_ADMIN_EMAILS=uno@empresa.cl,dos@empresa.cl,tres@empresa.cl
 * (coma, punto y coma o espacio como separador).
 * Requiere Supabase Auth: solo esas cuentas, tras iniciar sesión, pueden guardar o reiniciar.
 */
function parseAdminEmails(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return new Set()
  return new Set(
    s
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

const raw = import.meta.env.VITE_ADMIN_EMAILS ?? ''

export const adminEmailsSet = parseAdminEmails(raw)

/** Hay lista de admins y Supabase configurado: se exige sesión y correo en la lista para editar. */
export function isCompetenciaEditLockEnabled() {
  return adminEmailsSet.size > 0 && supabaseConfigured
}
