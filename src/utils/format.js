export const formatUF = (value) =>
  value ? `UF ${Number(value).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` : '—'

export const formatCLP = (value) =>
  value ? `$${Number(value).toLocaleString('es-CL')}` : '—'

export const formatDate = (dateStr) => {
  if (!dateStr || dateStr === 'NaT') return '—'
  const d = new Date(dateStr)
  return isNaN(d) ? dateStr : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatPct = (value) =>
  value != null ? `${Number(value).toFixed(1)}%` : '—'

export const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
