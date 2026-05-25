const DEFAULT_BASE_URL = 'https://ored.cl'

function getBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (!raw || typeof raw !== 'string') return DEFAULT_BASE_URL
  return raw.replace(/\/$/, '')
}

function getPeriodo() {
  const desde = import.meta.env.VITE_CYBER_DESDE
  const hasta = import.meta.env.VITE_CYBER_HASTA
  if (!desde || !hasta) {
    throw new Error('Faltan VITE_CYBER_DESDE / VITE_CYBER_HASTA en el .env.')
  }
  return { desde, hasta }
}

/**
 * @param {Object} [options]
 * @param {string} [options.desde]
 * @param {string} [options.hasta]
 * @param {number} [options.limit]
 * @param {AbortSignal} [options.signal]
 */
export async function fetchReservasOred(options = {}) {
  const baseUrl = getBaseUrl()
  const periodo = options.desde && options.hasta ? options : getPeriodo()

  const params = new URLSearchParams({
    desde: new Date(periodo.desde).toISOString(),
    hasta: new Date(periodo.hasta).toISOString(),
  })
  if (options.limit) params.set('limit', String(options.limit))

  const url = `${baseUrl}/api/public/encuentro-smart/ranking?${params}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error ? `: ${body.error}` : ''
    } catch { /* ignore */ }
    throw new Error(`ored API ${res.status}${detail}`)
  }

  const body = await res.json()
  if (!Array.isArray(body?.reservas)) {
    throw new Error('ored API: shape inválido (reservas no es array)')
  }
  return body
}
