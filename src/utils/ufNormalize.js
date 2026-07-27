/**
 * Normaliza un valor UF cuando la planilla trae demasiados dígitos:
 * - Se toma la parte entera (truncada, valor absoluto).
 * - Los primeros 4 dígitos forman la parte entera del resultado.
 * - Los siguientes 2 dígitos (de la misma cadena) son los decimales (hasta 2).
 *
 * Ej.: 18_676_006 → "18676006" → 1867.60
 * Ej.: 31066 → "31066" → 3106.66
 */
export function ufNormalizadoPlanilla(raw) {
  if (raw === null || raw === undefined || raw === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  const intPart = Math.trunc(Math.abs(n))
  const digits = intPart.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 })
  if (!digits || digits === '0') return 0

  const head = digits.slice(0, 4)
  const dec = (digits.slice(4, 6) + '00').slice(0, 2)
  const v = parseFloat(`${head}.${dec}`)
  return Math.round(v * 100) / 100
}

/**
 * UF a usar por reserva para totales: valor_promesa_uf si es distinto de 0; si no, valor_venta_uf.
 *
 * Las reservas con `uf_ya_normalizada` (origen Atlas Engine) traen el valor UF
 * limpio y se usan tal cual: pasarlas por `ufNormalizadoPlanilla` dividiria por
 * 10 cualquier propiedad de 10.000 UF o mas.
 */
export function ufMontoPlanillaReserva(r) {
  const prom = Number(r?.valor_promesa_uf)
  const raw = prom ? r.valor_promesa_uf : r.valor_venta_uf
  if (r?.uf_ya_normalizada) {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
  }
  return ufNormalizadoPlanilla(raw)
}
