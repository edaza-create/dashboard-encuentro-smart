#!/usr/bin/env node
/**
 * Genera maestra-index.json para Edge Function (sin importar src/ en Node).
 * Ejecutar tras: npm run sync:asesores
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const asesoresBP = JSON.parse(
  readFileSync(join(root, 'src/data/asesores-bp.json'), 'utf8')
)
const { EQUIPOS_CAPITAL_ONE } = await import(
  new URL('../src/data/competenciaCapitalOneTeams.js', import.meta.url).href
)
const { MIEMBROS_EQUIPO_COMERCIAL_INTERNO, BP_SLUG_EQUIPO_INTERNO, NIVEL_PLATAFORMA_EQUIPO_INTERNO } =
  await import(new URL('../src/data/equipoComercialInterno.js', import.meta.url).href)
const { BP_SLUG_TO_PLATAFORMA: BP_PLATAFORMA_CATALOG } = await import(
  new URL('../src/data/bpCatalog.js', import.meta.url).href
)

const BP_SLUG_TO_PLATAFORMA = {
  [BP_SLUG_EQUIPO_INTERNO]: NIVEL_PLATAFORMA_EQUIPO_INTERNO,
  ...BP_PLATAFORMA_CATALOG,
}

const bpDisplay = new Map(
  (asesoresBP.business_partners ?? []).map((bp) => [bp.slug, bp.display ?? bp.slug])
)

const emailToRow = new Map(
  (asesoresBP.asesores ?? []).map((a) => [normalizeEmail(a.email), a])
)

const internoEmails = new Map()
for (const m of MIEMBROS_EQUIPO_COMERCIAL_INTERNO) {
  for (const e of m.emails) {
    const k = normalizeEmail(e)
    if (k) internoEmails.set(k, m)
  }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const t = email.trim().toLowerCase()
  return t.includes('@') ? t : null
}

function equipoIdForNivel(nivel) {
  const n = String(nivel ?? '').trim()
  if (!n) return null
  for (const eq of EQUIPOS_CAPITAL_ONE) {
    for (const b of eq.brokers) {
      if ((b.nombresPlataforma || []).includes(n)) return String(eq.id)
    }
  }
  return null
}

function equipoLabel(id) {
  const eq = EQUIPOS_CAPITAL_ONE.find((e) => String(e.id) === String(id))
  return eq?.label ?? null
}

function resolve(email) {
  const key = normalizeEmail(email)
  if (!key) return null

  const interno = internoEmails.get(key)
  if (interno) {
    return {
      asesor_id: `email:${key}`,
      email: key,
      nombre: interno.nombre,
      subgrupo: 'Equipo Comercial Interno',
      equipo_id: null,
      equipo: null,
    }
  }

  const row = emailToRow.get(key)
  if (!row?.bp_slug) return null
  const plataforma = BP_SLUG_TO_PLATAFORMA[row.bp_slug] ?? ''
  const equipo_id = equipoIdForNivel(plataforma)
  return {
    asesor_id: `email:${key}`,
    email: key,
    nombre: row.nombre ?? null,
    subgrupo: bpDisplay.get(row.bp_slug) ?? row.bp_slug,
    equipo_id,
    equipo: equipo_id ? equipoLabel(equipo_id) : null,
  }
}

const index = {}
const roster = {}

for (const a of asesoresBP.asesores ?? []) {
  if (a.estado && a.estado !== 'ACTIVO') continue
  const r = resolve(a.email)
  if (!r) continue
  index[r.email] = r
  if (r.equipo_id) {
    if (!roster[r.equipo_id]) roster[r.equipo_id] = []
    roster[r.equipo_id].push(r.email)
  }
}

for (const [email] of internoEmails) {
  if (index[email]) continue
  const r = resolve(email)
  if (r) index[email] = r
}

const outDir = join(root, 'supabase/functions/forms-asistencia')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'maestra-index.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), index, roster }, null, 2) + '\n'
)
console.log('[build-maestra-index] emails:', Object.keys(index).length)
