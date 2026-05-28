#!/usr/bin/env node
/**
 * Fusiona hojas MBP de un xlsx "Lista Asesores Activos" en asesores-bp.json.
 *
 * Formato del xlsx (varias secciones por hoja MBP):
 *   - Fila encabezado de grupo en col A (verde / morado / naranja): ej. "Vanessa Chirinos / VANEMA"
 *   - Filas siguientes: col B = nombre, col C = mail, col D = ESTADO
 *   - Solo se importan filas con ESTADO = ACTIVO (case-insensitive)
 *   - Se ignoran filas TOTAL, sin email, y ELIMINADO
 *
 * Uso:
 *   node scripts/merge-lista-asesores-xlsx.mjs
 *   node scripts/merge-lista-asesores-xlsx.mjs "05-28-26 Lista Asesores Activos MAYO (2).xlsx"
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
const NOMBRE_COL_INDEX = 1
const EMAIL_COL_INDEX = 2
const ESTADO_COL_INDEX = 3

/** Emails que en el xlsx pueden aparecer bajo Vanema pero son BP Vivvoen. */
const VIVVOEN_EMAILS = new Set([
  'vivvoen@capitalinteligente.cl',
  'gsuarez@capitalinteligente.cl',
])

/** Encabezados de sección del xlsx que no están en label_origen del catálogo. */
const LABEL_SLUG_ALIASES = {
  'camilo olivero': 'olivero-partners',
}

function normalizeLabel(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildLabelToSlug() {
  const map = new Map()
  for (const b of BP_CATALOG) {
    map.set(normalizeLabel(b.label_origen), b.slug)
  }
  for (const [label, slug] of Object.entries(LABEL_SLUG_ALIASES)) {
    map.set(normalizeLabel(label), slug)
  }
  return map
}

const LABEL_TO_SLUG = buildLabelToSlug()

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, '').toLowerCase()
  return cleaned.includes('@') ? cleaned : null
}

function normalizeEstado(raw) {
  if (raw == null) return null
  return String(raw).trim().toUpperCase()
}

function isActivo(estado) {
  return normalizeEstado(estado) === 'ACTIVO'
}

/** Fila de encabezado de grupo BP (col A con nombre, sin mail en col C). */
function isSectionHeaderRow(row) {
  const label = String(row[0] ?? '').trim()
  if (!label) return false
  if (normalizeEmail(row[EMAIL_COL_INDEX])) return false
  if (/^total$/i.test(String(row[EMAIL_COL_INDEX] ?? ''))) return false
  if (/nombre\s+asesor/i.test(String(row[NOMBRE_COL_INDEX] ?? ''))) return false
  return true
}

function resolveBpSlug(sectionLabel) {
  const slug = LABEL_TO_SLUG.get(normalizeLabel(sectionLabel))
  if (!slug) {
    throw new Error(
      `[merge-lista-asesores-xlsx] Sección sin BP en catálogo: "${sectionLabel}". ` +
        'Añade label_origen en src/data/bpCatalog.js o LABEL_SLUG_ALIASES.'
    )
  }
  return slug
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

/**
 * @param {import('xlsx').WorkBook} wb
 * @returns {{ asesores: object[], xlsxBps: Map<string, string> }}
 */
function parseWorkbookSections(wb) {
  const sheetNames = wb.SheetNames.filter((n) => n.startsWith(SHEET_PREFIX))
  if (!sheetNames.length) throw new Error(`Sin hojas ${SHEET_PREFIX}* en el xlsx`)

  /** @type {Map<string, { email: string, nombre: string|null, estado: string, bp_slug: string, sheet: string }>} */
  const byEmail = new Map()
  /** slug → label_origen (primera sección vista) */
  const xlsxBps = new Map()

  for (const sheetName of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    })

    let sectionLabel = null

    for (const row of rows) {
      if (!row) continue

      if (isSectionHeaderRow(row)) {
        sectionLabel = String(row[0]).trim()
        const slug = resolveBpSlug(sectionLabel)
        if (!xlsxBps.has(slug)) xlsxBps.set(slug, sectionLabel)
        continue
      }

      const email = normalizeEmail(row[EMAIL_COL_INDEX])
      if (!email) continue
      if (!isActivo(row[ESTADO_COL_INDEX])) continue
      if (!sectionLabel) {
        console.warn(`[merge-lista-asesores-xlsx] ${email} sin sección en ${sheetName}, omitido`)
        continue
      }

      let bp_slug = resolveBpSlug(sectionLabel)
      if (VIVVOEN_EMAILS.has(email)) bp_slug = 'vivvoen'

      const entry = {
        email,
        nombre: typeof row[NOMBRE_COL_INDEX] === 'string' ? row[NOMBRE_COL_INDEX].trim() : null,
        estado: 'ACTIVO',
        bp_slug,
      }

      if (byEmail.has(email)) {
        const prev = byEmail.get(email)
        console.warn(
          `[merge-lista-asesores-xlsx] ${email}: ${prev.bp_slug} → ${bp_slug} (${sheetName} gana)`
        )
      }
      byEmail.set(email, { ...entry, sheet: sheetName })
    }
  }

  const asesores = [...byEmail.values()].map(({ sheet: _s, ...a }) => a)
  return { asesores, xlsxBps }
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

  return BP_CATALOG.filter((b) => slugSet.has(b.slug))
    .map((b) => ({
      slug: b.slug,
      display: b.display,
      label_origen: xlsxBps.get(b.slug) ?? b.label_origen,
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
  const { asesores: fromXlsx, xlsxBps } = parseWorkbookSections(wb)

  const xlsxSlugs = new Set(fromXlsx.map((a) => a.bp_slug))
  const xlsxEmails = new Set(fromXlsx.map((a) => a.email))

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
      if (m.estado && !isActivo(m.estado)) continue
      let bp_slug = grupo.slug
      if (VIVVOEN_EMAILS.has(email)) bp_slug = 'vivvoen'
      rosterExtra.push({
        email,
        nombre: m.nombre ?? null,
        estado: 'ACTIVO',
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
    source_file: `${sourceFile} (secciones por encabezado col A; solo ACTIVO)`,
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
      `  xlsx ACTIVO: ${fromXlsx.length} en ${xlsxBps.size} grupos BP · conservados otros BP: ${kept.length}\n` +
      `  roster extra (p. ej. portal .me): ${rosterExtra.length} · total: ${merged.length} · conflictos: ${conflictos.length}`
  )
  if (conflictos.length) {
    console.warn('[merge-lista-asesores-xlsx] emails en más de un BP:')
    for (const c of conflictos) console.warn('  -', c.email, '→', c.bps.join(', '))
  }
}

main()
