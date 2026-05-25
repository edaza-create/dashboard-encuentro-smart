#!/usr/bin/env node
/**
 * Regenera src/data/asesores-bp.json desde roster visual (roster-bp-grupos.mjs)
 * + conserva BPs en ROSTER_PRESERVE_SLUGS del archivo previo (Vanema, etc.).
 *
 * Uso: node scripts/apply-roster-bp.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BP_CATALOG } from '../src/data/bpCatalog.js'
import { ROSTER_GRUPOS, ROSTER_PRESERVE_SLUGS } from '../src/data/roster-bp-grupos.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT = join(ROOT, 'src/data/asesores-bp.json')

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, '').toLowerCase()
  return cleaned.includes('@') ? cleaned : null
}

function detectarConflictos(asesores) {
  const porEmail = new Map()
  for (const a of asesores) {
    const set = porEmail.get(a.email) ?? new Set()
    set.add(a.bp_slug)
    porEmail.set(a.email, set)
  }
  const dups = []
  for (const [email, bps] of porEmail) {
    if (bps.size > 1) dups.push({ email, bps: [...bps] })
  }
  return dups
}

function main() {
  const catalogBySlug = new Map(BP_CATALOG.map((b) => [b.slug, b]))
  const rosterSlugs = new Set(ROSTER_GRUPOS.map((g) => g.slug))

  for (const slug of rosterSlugs) {
    if (!catalogBySlug.has(slug)) {
      throw new Error(`Roster slug sin catálogo: ${slug}`)
    }
  }

  const asesores = []
  const seen = new Set()

  for (const grupo of ROSTER_GRUPOS) {
    for (const m of grupo.miembros) {
      const email = normalizeEmail(m.email)
      if (!email) continue
      if (seen.has(email)) {
        console.warn(`[apply-roster-bp] email duplicado en roster, se omite: ${email}`)
        continue
      }
      seen.add(email)
      asesores.push({
        email,
        nombre: m.nombre ?? null,
        estado: m.estado === 'ELIMINADO' ? 'ELIMINADO' : 'ACTIVO',
        bp_slug: grupo.slug,
      })
    }
  }

  let preserved = 0
  if (existsSync(OUTPUT)) {
    const prev = JSON.parse(readFileSync(OUTPUT, 'utf8'))
    for (const a of prev.asesores ?? []) {
      if (!ROSTER_PRESERVE_SLUGS.includes(a.bp_slug)) continue
      const email = normalizeEmail(a.email)
      if (!email || seen.has(email)) continue
      seen.add(email)
      asesores.push({
        email,
        nombre: a.nombre ?? null,
        estado: a.estado === 'ELIMINADO' ? 'ELIMINADO' : 'ACTIVO',
        bp_slug: a.bp_slug,
      })
      preserved++
    }
  }

  asesores.sort((a, b) => a.email.localeCompare(b.email))

  const slugSet = new Set([...rosterSlugs, ...ROSTER_PRESERVE_SLUGS])
  const business_partners = BP_CATALOG.filter((b) => slugSet.has(b.slug))
    .map((b) => ({
      slug: b.slug,
      display: b.display,
      label_origen: b.label_origen,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))

  const conflictos = detectarConflictos(asesores)

  const output = {
    generated_at: new Date().toISOString(),
    source_file: 'roster-bp-grupos.mjs (planilla visual Capital Open)',
    business_partners,
    asesores,
    stats: {
      total_bps: business_partners.length,
      total_asesores: asesores.length,
      activos: asesores.filter((a) => a.estado === 'ACTIVO').length,
      eliminados: asesores.filter((a) => a.estado === 'ELIMINADO').length,
      conflictos_email: conflictos.length,
      preservados_desde_json: preserved,
    },
  }

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(
    `[apply-roster-bp] OK · BPs: ${business_partners.length} · asesores: ${asesores.length}` +
      ` · activos: ${output.stats.activos} · preservados: ${preserved} · conflictos: ${conflictos.length}`
  )
  if (conflictos.length > 0) {
    console.warn('[apply-roster-bp] conflictos email→BP:')
    for (const c of conflictos) console.warn('  -', c.email, '→', c.bps.join(', '))
  }
}

main()
