#!/usr/bin/env node
// Regenera src/data/asesores-bp.json a partir del xlsx "Lista Asesores Activos *.xlsx"
// que vive en la raíz del repo.
//
// Uso:
//   pnpm run sync:asesores
//   pnpm run sync:asesores -- "Lista Asesores Activos MAYO.xlsx"
//
// Convenciones del xlsx (mantener al recibir uno nuevo):
//   - Una hoja por BP, nombre de hoja: "MBP <Slug del BP>"  (ej: "MBP Vanema")
//   - Fila 0 = headers
//   - Fila 1, columna A = label largo del BP (ej: "Vanessa Chirinos / VANEMA")
//   - Fila 2+ = asesores, con email en columna C (index 2) y estado en D (index 3)
//
// Si el formato cambia, ajustar HEADER_*_INDEX abajo.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUTPUT = join(ROOT, "src/data/asesores-bp.json");

const SHEET_PREFIX = "MBP ";
const EMAIL_COL_INDEX = 2;
const ESTADO_COL_INDEX = 3;
const BP_LABEL_ROW = 1;
const DATA_START_ROW = 2;

function pickXlsxFromArgsOrRoot() {
  const cliArg = process.argv[2];
  if (cliArg) {
    const p = resolve(ROOT, cliArg);
    if (!existsSync(p)) throw new Error(`Archivo no encontrado: ${p}`);
    return p;
  }
  const candidates = readdirSync(ROOT)
    .filter((f) => /^Lista Asesores Activos.*\.xlsx$/i.test(f))
    .sort();
  if (candidates.length === 0) {
    throw new Error(
      `No se encontró ningún 'Lista Asesores Activos*.xlsx' en ${ROOT}. ` +
        `Dejá el archivo en la raíz o pasalo como argumento.`
    );
  }
  return join(ROOT, candidates[candidates.length - 1]);
}

function slugify(input) {
  return String(input)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEmail(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, "").toLowerCase();
  if (!cleaned.includes("@")) return null;
  return cleaned;
}

function normalizeEstado(raw) {
  if (raw == null) return null;
  return String(raw).trim().toUpperCase();
}

function readSheet(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true
  });

  const bpDisplay = sheetName.replace(SHEET_PREFIX, "").trim();
  const bpSlug = slugify(bpDisplay);
  const bpLabel = rows[BP_LABEL_ROW]?.[0] ?? null;

  const asesores = [];
  const seen = new Set();
  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const email = normalizeEmail(r[EMAIL_COL_INDEX]);
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    const nombre = typeof r[1] === "string" ? r[1].trim() : null;
    const estado = normalizeEstado(r[ESTADO_COL_INDEX]);
    asesores.push({
      email,
      nombre,
      estado,
      bp_slug: bpSlug
    });
  }

  return { bp: { slug: bpSlug, display: bpDisplay, label_origen: bpLabel }, asesores };
}

function main() {
  const xlsxPath = pickXlsxFromArgsOrRoot();
  const sourceFile = xlsxPath.replace(ROOT + "/", "");
  console.log(`[sync-asesores-bp] leyendo: ${sourceFile}`);

  const wb = XLSX.read(readFileSync(xlsxPath), { type: "buffer", cellDates: false });
  const sheetNames = wb.SheetNames.filter((n) => n.startsWith(SHEET_PREFIX));

  if (sheetNames.length === 0) {
    throw new Error(`No hay hojas con prefijo '${SHEET_PREFIX}' en ${sourceFile}`);
  }

  const businessPartners = [];
  const asesores = [];
  for (const sheetName of sheetNames) {
    const { bp, asesores: lista } = readSheet(wb, sheetName);
    businessPartners.push(bp);
    asesores.push(...lista);
  }

  asesores.sort((a, b) => a.email.localeCompare(b.email));
  businessPartners.sort((a, b) => a.slug.localeCompare(b.slug));

  const conflictos = detectarEmailsDuplicadosEntreBPs(asesores);

  const output = {
    generated_at: new Date().toISOString(),
    source_file: sourceFile,
    business_partners: businessPartners,
    asesores,
    stats: {
      total_bps: businessPartners.length,
      total_asesores: asesores.length,
      activos: asesores.filter((a) => a.estado === "ACTIVO").length,
      eliminados: asesores.filter((a) => a.estado === "ELIMINADO").length,
      conflictos_email: conflictos.length
    }
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `[sync-asesores-bp] OK · BPs: ${businessPartners.length} · asesores: ${asesores.length}` +
      ` · activos: ${output.stats.activos} · conflictos: ${conflictos.length}`
  );
  if (conflictos.length > 0) {
    console.warn("[sync-asesores-bp] emails duplicados entre BPs (revisar):");
    for (const c of conflictos) console.warn("  -", c.email, "→", c.bps.join(", "));
  }
  console.log(`[sync-asesores-bp] escrito: ${OUTPUT.replace(ROOT + "/", "")}`);
}

function detectarEmailsDuplicadosEntreBPs(asesores) {
  const porEmail = new Map();
  for (const a of asesores) {
    const set = porEmail.get(a.email) ?? new Set();
    set.add(a.bp_slug);
    porEmail.set(a.email, set);
  }
  const dups = [];
  for (const [email, bps] of porEmail) {
    if (bps.size > 1) dups.push({ email, bps: [...bps] });
  }
  return dups;
}

main();
