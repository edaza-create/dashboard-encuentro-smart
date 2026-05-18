/**
 * Cliente del endpoint publico de ranking del Encuentro Smart Cyber.
 *
 * Endpoint en ored: GET /api/public/encuentro-smart/ranking?desde&hasta&limit
 * Response shape:
 *   {
 *     updated_at: string,
 *     periodo: { desde: string, hasta: string },
 *     reservas: Array<ReservaPublica>
 *   }
 *
 * Este cliente NO conoce credenciales. Si en el futuro queremos firmar, va a
 * un header — pero por diseno el endpoint es publico con CORS allowlist.
 */

/**
 * @typedef {Object} ReservaPublica
 * @property {string} reserva_id
 * @property {string} ocurrido_en
 * @property {string|null} fecha
 * @property {string|null} hora
 * @property {string|null} proyecto
 * @property {string|null} inmobiliaria
 * @property {string|null} unidad
 * @property {number|null} monto_uf
 * @property {string|null} asesor_email
 * @property {string|null} asesor_nombre
 * @property {string|null} asesor_foto_url - URL default (suele ser variante 400)
 * @property {Record<string, string>|null} asesor_foto_urls - variantes por tamaño en px (e.g. {"100", "400", "800"})
 */

/**
 * @typedef {Object} RankingResponse
 * @property {string} updated_at
 * @property {{ desde: string, hasta: string }} periodo
 * @property {ReservaPublica[]} reservas
 */

const DEFAULT_BASE_URL = "https://ored.cl";

function getBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw || typeof raw !== "string") return DEFAULT_BASE_URL;
  return raw.replace(/\/$/, "");
}

function getPeriodo() {
  const desde = import.meta.env.VITE_CYBER_DESDE;
  const hasta = import.meta.env.VITE_CYBER_HASTA;
  if (!desde || !hasta) {
    throw new Error(
      "Faltan VITE_CYBER_DESDE / VITE_CYBER_HASTA en el .env. Copiar de .env.example."
    );
  }
  return { desde, hasta };
}

/**
 * Trae las reservas Brekto del periodo del Cyber.
 * @param {Object} [options]
 * @param {string} [options.desde] - override del periodo (ISO 8601)
 * @param {string} [options.hasta] - override del periodo (ISO 8601)
 * @param {number} [options.limit] - default backend = 5000
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<RankingResponse>}
 */
export async function fetchReservasRanking(options = {}) {
  const baseUrl = getBaseUrl();
  const periodo = options.desde && options.hasta ? options : getPeriodo();

  const params = new URLSearchParams({
    desde: new Date(periodo.desde).toISOString(),
    hasta: new Date(periodo.hasta).toISOString()
  });
  if (options.limit) params.set("limit", String(options.limit));

  const url = `${baseUrl}/api/public/encuentro-smart/ranking?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error ? `: ${body.error}` : "";
    } catch {
      // ignore
    }
    throw new Error(`Ranking API ${res.status}${detail}`);
  }

  const body = await res.json();
  if (!Array.isArray(body?.reservas)) {
    throw new Error("Ranking API: shape invalido (reservas no es array)");
  }
  return body;
}
