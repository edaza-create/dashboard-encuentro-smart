import { lookupAsesorBp } from './asesorBpPlataforma.js'

function normEmail(v) {
  return String(v ?? '').trim().toLowerCase()
}

function normNombre(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * @param {import('../data/competenciaCapitalOneTeams.js').BrokerCompetencia} broker
 * @param {object} r
 */
export function reservaMatchesBroker(r, broker) {
  if (!r || !broker) return false

  const nivel = String(r.nivel_jerarquia_nombre ?? '').trim()
  const email = normEmail(r.user_email ?? r.asesor_email)
  const nombreAsesor = normNombre(r.nombre_asesor ?? r.asesor_nombre)

  const plataformas = broker.nombresPlataforma ?? []
  if (plataformas.length && plataformas.includes(nivel)) return true

  const emails = (broker.emails ?? []).map(normEmail).filter(Boolean)
  if (emails.length && email && emails.includes(email)) return true

  const slugs = broker.bpSlugs ?? []
  if (slugs.length && email) {
    const { bp_slug } = lookupAsesorBp(email)
    if (bp_slug && slugs.includes(bp_slug)) {
      // Si el broker define emails exclusivos, el slug solo no basta (evita mezclar sub-marcas).
      if (!emails.length) return true
    }
  }

  const nombresAsesor = (broker.asesorNombres ?? []).map(normNombre).filter(Boolean)
  if (nombresAsesor.length && nombreAsesor && nombresAsesor.includes(nombreAsesor)) return true

  return false
}

/** Broker con al menos una regla de mapeo (plataforma, email o slug). */
export function brokerTieneMapeo(broker) {
  return !!(
    broker?.nombresPlataforma?.length ||
    broker?.emails?.length ||
    broker?.bpSlugs?.length ||
    broker?.asesorNombres?.length
  )
}
