/**
 * Agrega reservas crudas (del endpoint de ored) en rankings individual y por BP.
 *
 * El mapping asesor->BP vive en `src/data/asesores-bp.json`, generado por
 * `pnpm run sync:asesores` desde el xlsx en raiz. La key de join es el email
 * en minusculas (el RPC ya lo normaliza, pero aplicamos lower() defensivo).
 *
 * Asesores que NO matchean ningun BP se agrupan en un bucket "sin-bp" para
 * no perderlos del conteo y para detectar mappings faltantes en QA.
 */

import asesoresBP from "../data/asesores-bp.json" with { type: "json" };
import { lookupAsesorBp } from "./asesorBpPlataforma.js";
import { BP_SLUG_EQUIPO_INTERNO, NIVEL_PLATAFORMA_EQUIPO_INTERNO } from "../data/equipoComercialInterno.js";
import { miembroPorNombre } from "./equipoComercialInterno.js";
import { canonicalAsesorEmail } from "./asesorEmail.js";

const SIN_BP_SLUG = "sin-bp";
const SIN_BP_DISPLAY = "Sin BP asignado";

function buildBpIndex() {
  const map = new Map();
  for (const bp of asesoresBP.business_partners) {
    map.set(bp.slug, bp);
  }
  map.set(SIN_BP_SLUG, { slug: SIN_BP_SLUG, display: SIN_BP_DISPLAY, label_origen: null });
  map.set(BP_SLUG_EQUIPO_INTERNO, {
    slug: BP_SLUG_EQUIPO_INTERNO,
    display: NIVEL_PLATAFORMA_EQUIPO_INTERNO,
    label_origen: null,
  });
  return map;
}

function bpSlugForReserva(email, nombre) {
  const mapping = email ? ASESOR_INDEX.get(email) : null;
  if (mapping?.bp_slug) return mapping.bp_slug;
  const lookup = lookupAsesorBp(email ?? "");
  if (lookup.bp_slug) return lookup.bp_slug;
  if (miembroPorNombre(nombre)) return BP_SLUG_EQUIPO_INTERNO;
  return SIN_BP_SLUG;
}

function buildAsesorIndex() {
  const map = new Map();
  for (const a of asesoresBP.asesores) {
    map.set(a.email.toLowerCase(), a);
  }
  return map;
}

const BP_INDEX = Object.freeze(buildBpIndex());
const ASESOR_INDEX = Object.freeze(buildAsesorIndex());

function toNum(v) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function reservaFotoTs(reserva) {
  const raw = reserva?.ocurrido_en ?? reserva?.fecha ?? "";
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Conserva la foto de la reserva más reciente (por ocurrido_en).
 * @param {{ foto_url?: string|null, foto_urls?: Record<string,string>|null, _ts?: number }|null|undefined} current
 * @param {import('../api/rankingClient.js').ReservaPublica} reserva
 */
export function mergeFotoFromReserva(current, reserva) {
  if (!reserva) return current ?? null;
  const foto_url = reserva.asesor_foto_url ?? null;
  const foto_urls = reserva.asesor_foto_urls ?? null;
  if (!foto_url && !foto_urls) return current ?? null;
  const ts = reservaFotoTs(reserva);
  if (current && ts < (current._ts ?? 0)) return current;
  return {
    foto_url: foto_url ?? current?.foto_url ?? null,
    foto_urls: foto_urls ?? current?.foto_urls ?? null,
    _ts: ts,
  };
}

/** Evita cache del navegador cuando ored actualiza avatars en la misma URL. */
export function avatarUrlWithCacheBust(url, version) {
  if (!url || version == null || version === "") return url ?? null;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(String(version))}`;
}

/**
 * Elige la mejor variante de foto de un asesor para el tamaño solicitado.
 * El backend devuelve `asesor_foto_urls` como `{ "100": url, "400": url, "800": url }`
 * (algunos asesores solo tienen `asesor_foto_url` legacy).
 *
 * Estrategia: pedir 2x el tamaño visible (retina-friendly) y elegir la variante
 * disponible mas pequena que sea >= ese target. Fallback al original.
 *
 * @param {import('../api/rankingClient.js').ReservaPublica} reserva
 * @param {number} displaySize - tamano visible en px (e.g. 72 para avatar de fila)
 * @returns {string|null}
 */
export function pickAvatarSrc(reserva, displaySize = 72) {
  if (!reserva) return null;
  const target = displaySize * 2; // retina

  const variants = reserva.asesor_foto_urls;
  if (variants && typeof variants === "object") {
    const sizes = Object.keys(variants)
      .map((k) => ({ size: Number(k), url: variants[k] }))
      .filter((v) => Number.isFinite(v.size) && typeof v.url === "string")
      .sort((a, b) => a.size - b.size);

    const fit = sizes.find((v) => v.size >= target) ?? sizes[sizes.length - 1];
    if (fit?.url) return fit.url;
  }

  return reserva.asesor_foto_url ?? null;
}

/**
 * @param {import('../api/rankingClient.js').ReservaPublica[]} reservas
 * @returns {{
 *   asesores: Array<{ email: string, nombre: string|null, bp_slug: string, bp_display: string, total: number, monto_uf_total: number, foto_url: string|null, foto_urls: Record<string,string>|null, reservas: import('../api/rankingClient.js').ReservaPublica[] }>,
 *   bps: Array<{ slug: string, display: string, total: number, monto_uf_total: number, asesores_activos: number }>,
 *   huerfanos: Array<{ email: string, nombre: string|null, total: number, monto_uf_total: number }>
 * }}
 */
export function buildRanking(reservas) {
  const porAsesor = new Map();
  const porBP = new Map();

  for (const r of reservas) {
    const email = canonicalAsesorEmail(r.asesor_email);
    if (!email) continue;

    const mapping = ASESOR_INDEX.get(email);
    const bpSlug = bpSlugForReserva(email, r.asesor_nombre);
    const bp = BP_INDEX.get(bpSlug);
    const uf = toNum(r.monto_uf);

    if (!porAsesor.has(email)) {
      porAsesor.set(email, {
        email,
        nombre: mapping?.nombre ?? r.asesor_nombre ?? null,
        bp_slug: bpSlug,
        bp_display: bp.display,
        total: 0,
        monto_uf_total: 0,
        foto_url: null,
        foto_urls: null,
        _foto: null,
        reservas: []
      });
    }
    const filaAsesor = porAsesor.get(email);
    filaAsesor.total += 1;
    filaAsesor.monto_uf_total += uf;
    filaAsesor.reservas.push(r);
    const merged = mergeFotoFromReserva(filaAsesor._foto, r);
    if (merged) {
      filaAsesor._foto = merged;
      filaAsesor.foto_url = merged.foto_url;
      filaAsesor.foto_urls = merged.foto_urls;
    }

    if (!porBP.has(bpSlug)) {
      porBP.set(bpSlug, {
        slug: bpSlug,
        display: bp.display,
        total: 0,
        monto_uf_total: 0,
        asesores_activos: new Set()
      });
    }
    const filaBP = porBP.get(bpSlug);
    filaBP.total += 1;
    filaBP.monto_uf_total += uf;
    filaBP.asesores_activos.add(email);
  }

  const asesoresArr = [...porAsesor.values()]
    .map(({ _foto, ...rest }) => rest)
    .sort((a, b) => b.total - a.total);

  const bpsArr = [...porBP.values()]
    .map((b) => ({
      slug: b.slug,
      display: b.display,
      total: b.total,
      monto_uf_total: b.monto_uf_total,
      asesores_activos: b.asesores_activos.size
    }))
    .sort((a, b) => b.total - a.total);

  const huerfanos = asesoresArr
    .filter((a) => a.bp_slug === SIN_BP_SLUG)
    .map((a) => ({
      email: a.email,
      nombre: a.nombre,
      total: a.total,
      monto_uf_total: a.monto_uf_total
    }));

  return { asesores: asesoresArr, bps: bpsArr, huerfanos };
}
