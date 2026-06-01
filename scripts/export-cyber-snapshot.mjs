#!/usr/bin/env node
/**
 * Extrae snapshot del ranking público Cyber (rama feat/ranking-publico-cyber).
 * - Reservas: GET ored /api/public/encuentro-smart/ranking
 * - Rankings: buildRankingCompetencia (individual + equipos + huérfanos)
 * - Roster: asesores-bp.json + resumen por BP
 *
 * Uso: node scripts/export-cyber-snapshot.mjs
 * Salida: exports/cyber-snapshot.json (gitignored)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lookupAsesorBp } from '../src/utils/asesorBpPlataforma.js'
import { BP_CATALOG } from '../src/data/bpCatalog.js'

const { buildRankingCompetencia } = await import(
  new URL('../src/utils/buildRankingCompetencia.js', import.meta.url).href
)

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'exports')
const OUT_FILE = join(OUT_DIR, 'cyber-snapshot.json')

/** Defaults de .env.example (rama ranking-publico-cyber) */
const CYBER = {
  apiBase: 'https://ored.cl',
  desde: '2026-05-15T00:00:00-04:00',
  hasta: '2026-07-15T23:59:59-04:00',
  eventoNombre: 'Capital Open',
  eventoSubtitulo: 'Cyber Junio 2026',
}

async function fetchRanking() {
  const params = new URLSearchParams({
    desde: new Date(CYBER.desde).toISOString(),
    hasta: new Date(CYBER.hasta).toISOString(),
  })
  const url = `${CYBER.apiBase}/api/public/encuentro-smart/ranking?${params}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

function resumenPorBp(asesoresBP) {
  const map = new Map()
  for (const a of asesoresBP.asesores ?? []) {
    if (a.estado !== 'ACTIVO') continue
    const slug = a.bp_slug ?? 'sin-bp'
    if (!map.has(slug)) map.set(slug, [])
    map.get(slug).push({ email: a.email, nombre: a.nombre })
  }
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slug, list]) => [
      slug,
      { count: list.length, asesores: list.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')) },
    ])
  )
}

function huerfanosDesdeReservas(reservas) {
  const porEmail = new Map()
  for (const r of reservas ?? []) {
    const email = (r.asesor_email ?? '').trim().toLowerCase()
    if (!email) continue
    const bp = lookupAsesorBp(email)
    if (bp.bp_slug) continue
    if (!porEmail.has(email)) {
      porEmail.set(email, { email, nombre: r.asesor_nombre, reservas: 0 })
    }
    porEmail.get(email).reservas += 1
  }
  return [...porEmail.values()].sort((a, b) => b.reservas - a.reservas)
}

async function main() {
  const asesoresBP = JSON.parse(readFileSync(join(ROOT, 'src/data/asesores-bp.json'), 'utf8'))
  console.log('[export-cyber] fetching ored…')
  const api = await fetchRanking()
  const reservas = api.reservas ?? []
  const ranking = buildRankingCompetencia(reservas)

  const snapshot = {
    exported_at: new Date().toISOString(),
    branch: 'feat/ranking-publico-cyber',
    config: CYBER,
    api: {
      updated_at: api.updated_at,
      periodo: api.periodo,
      total_reservas: reservas.length,
    },
    catalogo_bps: BP_CATALOG,
    roster_stats: asesoresBP.stats,
    roster_por_bp: resumenPorBp(asesoresBP),
    ranking: {
      scoring: ranking.scoring,
      asesores_individual: ranking.asesores,
      equipos_bp: ranking.bps,
      huerfanos: ranking.huerfanos,
    },
    huerfanos_en_api: huerfanosDesdeReservas(reservas),
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  console.log(`[export-cyber] OK → ${OUT_FILE.replace(ROOT + '/', '')}`)
  console.log(
    `[export-cyber] reservas: ${reservas.length} · asesores ranking: ${ranking.asesores.length} · equipos: ${ranking.bps.length} · huérfanos: ${snapshot.huerfanos_en_api.length}`
  )
}

main().catch((err) => {
  console.error('[export-cyber]', err.message ?? err)
  process.exit(1)
})
