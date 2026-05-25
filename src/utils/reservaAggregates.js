/**
 * Agregaciones compartidas entre Resumen, Conteos y rankings.
 */

export function countBy(reservas, accessor) {
  const m = {}
  for (const r of reservas) {
    const raw = accessor(r)
    const k = raw != null && String(raw).trim() !== '' ? String(raw).trim() : 'Sin dato'
    m[k] = (m[k] || 0) + 1
  }
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function shortLabel(s, max = 18) {
  const t = String(s ?? '').trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export function monthKeyFromReserva(fecha) {
  if (!fecha || typeof fecha !== 'string') return null
  return fecha.slice(0, 7)
}

export function pctChange(cur, prev) {
  if (prev === 0) {
    if (cur > 0) return { label: 'Nuevo', dir: 'up' }
    return { label: '0%', dir: 'flat' }
  }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return {
    label: `${pct >= 0 ? '+' : ''}${pct}%`,
    dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  }
}
