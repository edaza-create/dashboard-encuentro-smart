#!/usr/bin/env node
/**
 * Lee "Correos .me.xlsx" y reporta cuentas @capitalinteligente.me vs asesores-bp.json.
 * La fuente de verdad para el merge es roster-bp-grupos.mjs; tras editar el roster:
 *   pnpm run apply:roster && pnpm run build:maestra-index
 *
 * Uso:
 *   node scripts/merge-correos-me.mjs
 *   node scripts/merge-correos-me.mjs "Correos .me.xlsx"
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { BP_CATALOG } from '../src/data/bpCatalog.js'
import { canonicalAsesorEmail } from '../src/utils/asesorEmail.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const DEFAULT_XLSX = join(ROOT, 'Correos .me.xlsx')
const ASESORES_JSON = join(ROOT, 'src/data/asesores-bp.json')

const EMAIL_COL = 2
const NOMBRE_COL = 1
const ESTADO_COL = 3

/** display de hoja "MBP X" → slug */
const BP_SLUG_BY_SHEET_SUFFIX = Object.fromEntries(
  BP_CATALOG.map((b) => [b.display, b.slug])
)
BP_SLUG_BY_SHEET_SUFFIX['Marisio Inversiones'] = 'marisio-inversiones'
BP_SLUG_BY_SHEET_SUFFIX['Mendoza'] = 'mendoza'

function pickXlsx() {
  const arg = process.argv[2]
  const p = arg ? resolve(ROOT, arg) : DEFAULT_XLSX
  if (!existsSync(p)) throw new Error(`No existe: ${p}`)
  return p
}

function normalizeEstado(raw) {
  const e = String(raw ?? 'ACTIVO').trim().toUpperCase()
  return e === 'ELIMINADO' ? 'ELIMINADO' : 'ACTIVO'
}

function parseEntries(xlsxPath) {
  const wb = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' })
  const out = []
  for (const sheetName of wb.SheetNames) {
    if (!sheetName.startsWith('MBP ')) continue
    const suffix = sheetName.replace(/^MBP\s+/i, '').trim()
    const bp_slug = BP_SLUG_BY_SHEET_SUFFIX[suffix]
    if (!bp_slug) {
      console.warn(`[merge-correos-me] hoja sin slug en catálogo: ${sheetName}`)
      continue
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: false,
    })
    for (const r of rows) {
      const raw = String(r[EMAIL_COL] ?? '').replace(/\s+/g, '')
      if (!raw.toLowerCase().includes('@capitalinteligente.me')) continue
      const email_me = raw.toLowerCase()
      const email = canonicalAsesorEmail(email_me)
      if (!email) continue
      out.push({
        email_me,
        email,
        nombre: r[NOMBRE_COL] != null ? String(r[NOMBRE_COL]).trim() : null,
        estado: normalizeEstado(r[ESTADO_COL]),
        bp_slug,
        sheet: sheetName,
      })
    }
  }
  return out
}

function main() {
  const xlsxPath = pickXlsx()
  const entries = parseEntries(xlsxPath)
  const data = JSON.parse(readFileSync(ASESORES_JSON, 'utf8'))
  const byEmail = new Map((data.asesores ?? []).map((a) => [a.email.toLowerCase(), a]))

  const nuevos = []
  const ok = []
  const conflicto = []

  for (const e of entries) {
    const existing = byEmail.get(e.email)
    if (!existing) {
      nuevos.push(e)
      continue
    }
    if (existing.bp_slug === e.bp_slug) ok.push(e)
    else conflicto.push({ ...e, existing_bp: existing.bp_slug, existing_nombre: existing.nombre })
  }

  console.log(`[merge-correos-me] ${xlsxPath.replace(ROOT + '/', '')}`)
  console.log(`  Cuentas .me en xlsx: ${entries.length}`)
  console.log(`  Ya en maestra (mismo BP): ${ok.length}`)
  console.log(`  Pendientes (agregar al roster): ${nuevos.length}`)
  console.log(`  Conflicto BP distinto: ${conflicto.length}`)

  if (nuevos.length) {
    console.log('\nAgregar a roster-bp-grupos.mjs (email .cl canónico):')
    const byBp = new Map()
    for (const n of nuevos) {
      if (!byBp.has(n.bp_slug)) byBp.set(n.bp_slug, [])
      byBp.get(n.bp_slug).push(n)
    }
    for (const [slug, list] of [...byBp].sort()) {
      console.log(`\n  ${slug}:`)
      for (const n of list) {
        const estado = n.estado === 'ELIMINADO' ? ", 'ELIMINADO'" : ''
        console.log(`    ['${n.email}', '${n.nombre ?? ''}'${estado}],`)
      }
    }
  }

  if (conflicto.length) {
    console.log('\nYa existen con otro BP (no duplicar; .me resuelve por canonical):')
    for (const c of conflicto) {
      console.log(
        `  ${c.email_me} → maestra ${c.email} en ${c.existing_bp} (xlsx dice ${c.bp_slug})`
      )
    }
  }

  if (nuevos.length === 0 && conflicto.length === 0) {
    console.log('\nMaestra al día. Ejecutá apply:roster si cambiaste el roster.')
  } else if (nuevos.length === 0) {
    console.log('\nTras actualizar roster: pnpm run apply:roster && pnpm run build:maestra-index')
  }
}

main()
