#!/usr/bin/env node
/**
 * Fusiona hojas MBP de un xlsx "Lista Asesores Activos" en asesores-bp.json
 * sin borrar BPs que solo existen en roster (IRC, Olivero, etc.).
 *
 * Uso:
 *   node scripts/merge-lista-asesores-xlsx.mjs
 *   node scripts/merge-lista-asesores-xlsx.mjs "05-28-26 Lista Asesores Activos MAYO (2).xlsx"
 *
 * Post-patch: vivvoen@ y gsuarez@ pasan a bp_slug vivvoen (grupo Vivvoen, no Vanema).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { BP_CATALOG } from '../src/data/bpCatalog.js'
import { ROSTER_GRUPOS } from '../src/data/roster-bp-grupos.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT = join(ROOT, 'src/data/asesores-bp.json')

const SHEET_PREFIX = 'MBP '
const EMAIL_COL_INDEX = 2
const ESTADO_COL_INDEX = 3
const DATA_START_ROW = 2

/** Emails que en el xlsx vienen bajo hoja Vanema pero son BP Vivvoen. */
const VIVVOEN_EMAILS = new Set([
  'vivvoen@capitalinteligente.cl',
  'gsuarez@capitalinteligente.cl',
])

function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, '').toLowerCase()
  return cleaned.includes('@') ? cleaned : null
}

function normalizeEstado(raw) {
  if (raw == null) return null
  return String(raw).trim().toUpperCase()
}

function pickXlsx(cliArg) {
  if (cliArg) {
    const p = resolve(ROOT, cliArg)
    if (!existsSync(p)) throw new Error(`No existe: ${p}`)
    return p
  }
  const preferred = join(ROOT, '05-28-26 Lista Asesores Activos MAYO (2).xlsx')
  if (existsSync(preferred)) return preferred
  throw new Error('Pasa el xlsx como argumento o deja 05-28-26 Lista Asesores Activos MAYO (2).xlsx en la raíz')
}

function readSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  })
  const bpDisplay = sheetName.replace(SHEET_PREFIX, '').trim()
  const bpSlug = slugify(bpDisplay)
  const bpLabel = rows[1]?.[0] ?? null
  const asesores = []
  const seen = new Set()
  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const email = normalizeEmail(r[EMAIL_COL_INDEX])
    if (!email || seen.has(email)) continue
    seen.add(email)
    let bp_slug = bpSlug
    if (VIVVOEN_EMAILS.has(email)) bp_slug = 'vivvoen'
    asesores.push({
      email,
      nombre: typeof r[1] === 'string' ? r[1].trim() : null,
      estado: normalizeEstado(r[ESTADO_COL_INDEX]),
      bp_slug,
    })
  }
  return { bp: { slug: bpSlug, display: bpDisplay, label_origen: bpLabel }, asesores }
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

function buildBusinessPartners(asesores, xlsxBps) {
  const slugSet = new Set(asesores.map((a) => a.bp_slug))
  slugSet.add('vivvoen')
  for (const bp of xlsxBps) slugSet.add(bp.slug)

  return BP_CATALOG.filter((b) => slugSet.has(b.slug))
    .map((b) => ({
      slug: b.slug,
      display: b.display,
      label_origen: xlsxBps.find((x) => x.slug === b.slug)?.label_origen ?? b.label_origen,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

function main() {
  const xlsxPath = pickXlsx(process.argv[2])
  const sourceFile = xlsxPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')

  const prev = existsSync(OUTPUT)
    ? JSON.parse(readFileSync(OUTPUT, 'utf8'))
    : { asesores: [], business_partners: [] }

  const wb = XLSX.read(readFileSync(xlsxPath), { type: 'buffer', cellDates: false })
  const sheetNames = wb.SheetNames.filter((n) => n.startsWith(SHEET_PREFIX))
  if (!sheetNames.length) throw new Error(`Sin hojas ${SHEET_PREFIX}* en ${sourceFile}`)

  const xlsxBps = []
  const byEmailXlsx = new Map()
  for (const sheetName of sheetNames) {
    const { bp, asesores } = readSheet(wb, sheetName)
    xlsxBps.push(bp)
    for (const a of asesores) {
      if (byEmailXlsx.has(a.email)) {
        const prev = byEmailXlsx.get(a.email)
        console.warn(
          `[merge-lista-asesores-xlsx] ${a.email}: ${prev.bp_slug} → ${a.bp_slug} (hoja ${sheetName} gana)`
        )
      }
      byEmailXlsx.set(a.email, a)
    }
  }
  const fromXlsx = [...byEmailXlsx.values()]

  const xlsxSlugs = new Set(xlsxBps.map((b) => b.slug))
  const xlsxEmails = new Set(fromXlsx.map((a) => a.email))

  // Quitar del JSON previo cualquier email que venga en el xlsx (el Excel manda el BP).
  const kept = (prev.asesores ?? []).filter(
    (a) => !xlsxSlugs.has(a.bp_slug) && !xlsxEmails.has(a.email)
  )

  const rosterExtra = []
  const seen = new Set([...kept.map((a) => a.email), ...xlsxEmails])
  for (const grupo of ROSTER_GRUPOS) {
    if (!xlsxSlugs.has(grupo.slug) && grupo.slug !== 'vivvoen') continue
    for (const m of grupo.miembros) {
      const email = normalizeEmail(m.email)
      if (!email || seen.has(email)) continue
      let bp_slug = grupo.slug
      if (VIVVOEN_EMAILS.has(email)) bp_slug = 'vivvoen'
      rosterExtra.push({
        email,
        nombre: m.nombre ?? null,
        estado: m.estado === 'ELIMINADO' ? 'ELIMINADO' : 'ACTIVO',
        bp_slug,
      })
      seen.add(email)
    }
  }

  const merged = [...kept, ...fromXlsx, ...rosterExtra].sort((a, b) =>
    a.email.localeCompare(b.email)
  )
  const business_partners = buildBusinessPartners(merged, xlsxBps)
  const conflictos = detectarConflictos(merged)

  const output = {
    generated_at: new Date().toISOString(),
    source_file: `${sourceFile} (merge en asesores-bp.json; BPs fuera del xlsx conservados)`,
    business_partners,
    asesores: merged,
    stats: {
      total_bps: business_partners.length,
      total_asesores: merged.length,
      activos: merged.filter((a) => a.estado === 'ACTIVO').length,
      eliminados: merged.filter((a) => a.estado === 'ELIMINADO').length,
      conflictos_email: conflictos.length,
      desde_xlsx: fromXlsx.length,
      conservados_otros_bp: kept.length,
      anadidos_desde_roster: rosterExtra.length,
    },
  }

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(
    `[merge-lista-asesores-xlsx] OK · ${sourceFile}\n` +
      `  xlsx: ${fromXlsx.length} en ${sheetNames.length} hojas · conservados otros BP: ${kept.length}\n` +
      `  roster extra (p. ej. portal .me): ${rosterExtra.length} · total: ${merged.length} · conflictos: ${conflictos.length}`
  )
  if (conflictos.length) {
    console.warn('[merge-lista-asesores-xlsx] emails en más de un BP:')
    for (const c of conflictos) console.warn('  -', c.email, '→', c.bps.join(', '))
  }
}

main()
