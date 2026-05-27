/** Dominios corporativos de asesor (mismo localpart; maestra indexada en .cl). */
export const ASESOR_EMAIL_DOMAIN_CL = '@capitalinteligente.cl'
export const ASESOR_EMAIL_DOMAIN_ME = '@capitalinteligente.me'

/**
 * @param {unknown} email
 * @returns {string|null}
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const t = email.trim().toLowerCase()
  return t.includes('@') ? t : null
}

/**
 * Email canónico para maestra, ranking y storage (.me → .cl).
 * @param {unknown} email
 * @returns {string|null}
 */
export function canonicalAsesorEmail(email) {
  const n = normalizeEmail(email)
  if (!n) return null
  if (n.endsWith(ASESOR_EMAIL_DOMAIN_ME)) {
    return n.slice(0, -ASESOR_EMAIL_DOMAIN_ME.length) + ASESOR_EMAIL_DOMAIN_CL
  }
  return n
}

/** @param {unknown} email */
export function isCorporateAsesorEmail(email) {
  const n = normalizeEmail(email)
  if (!n) return false
  return n.endsWith(ASESOR_EMAIL_DOMAIN_CL) || n.endsWith(ASESOR_EMAIL_DOMAIN_ME)
}
