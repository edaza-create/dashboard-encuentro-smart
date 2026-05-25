/**
 * Orden de ranking: más puntos → más UF cartera → nombre (es).
 * @param {{ totalPuntos?: number, total?: number, ufTotal?: number, nombre?: string, etiqueta?: string, display?: string }} a
 * @param {typeof a} b
 */
export function compareRankingPorPuntosYUf(a, b) {
  const puntosA = Number(a.totalPuntos ?? a.total) || 0
  const puntosB = Number(b.totalPuntos ?? b.total) || 0
  if (puntosB !== puntosA) return puntosB - puntosA

  const ufA = Number(a.ufTotal) || 0
  const ufB = Number(b.ufTotal) || 0
  if (ufB !== ufA) return ufB - ufA

  const labelA = a.nombre ?? a.etiqueta ?? a.display ?? ''
  const labelB = b.nombre ?? b.etiqueta ?? b.display ?? ''
  return String(labelA).localeCompare(String(labelB), 'es', { sensitivity: 'base' })
}
