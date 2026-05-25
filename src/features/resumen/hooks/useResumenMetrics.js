import { useMemo } from 'react'
import { format, eachMonthOfInterval, startOfMonth, subMonths, parseISO, getDay, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { monthKeyFromReserva, pctChange } from '../../../utils/reservaAggregates.js'
import { ufMontoPlanillaReserva } from '../../../utils/ufNormalize.js'

/**
 * Agregación en una pasada + series mensuales.
 * @param {object[]} reservas
 * @param {number} chartMonths
 */
export function computeResumenMetrics(reservas, chartMonths = 6) {
  const now = new Date()
  const thisMonthKey = format(startOfMonth(now), 'yyyy-MM')
  const prevMonthKey = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM')

  const inmobMap = {}
  const comunaMap = {}
  const tipoMap = {}
  const proyectoMap = {}
  const monthBuckets = {}
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]

  let totalUF = 0
  let futuraN = 0
  let pend = 0
  let apr = 0
  let canc = 0
  let other = 0
  let countThisMonth = 0
  let countPrevMonth = 0

  for (const r of reservas) {
    const uf = ufMontoPlanillaReserva(r)
    totalUF += uf

    if (r.tipo_entrega === 'futura') futuraN++

    const e = r.estado
    if (e === 'Pendiente') pend++
    else if (e === 'Aprobado') apr++
    else if (e === 'Cancelado') canc++
    else other++

    const inmob = r.inmobiliaria != null && String(r.inmobiliaria).trim() !== '' ? String(r.inmobiliaria).trim() : 'Sin dato'
    inmobMap[inmob] = (inmobMap[inmob] || 0) + 1

    const comuna = r.comuna != null && String(r.comuna).trim() !== '' ? String(r.comuna).trim() : 'Sin dato'
    comunaMap[comuna] = (comunaMap[comuna] || 0) + 1

    const tipo = r.tipologia != null && String(r.tipologia).trim() !== '' ? String(r.tipologia).trim() : 'Sin dato'
    tipoMap[tipo] = (tipoMap[tipo] || 0) + 1

    const proy = r.proyecto != null && String(r.proyecto).trim() !== '' ? String(r.proyecto).trim() : 'Sin dato'
    proyectoMap[proy] = (proyectoMap[proy] || 0) + 1

    const mk = monthKeyFromReserva(r.fecha_reserva)
    if (mk) {
      if (!monthBuckets[mk]) monthBuckets[mk] = { reservas: 0, uf: 0 }
      monthBuckets[mk].reservas++
      monthBuckets[mk].uf += uf
      if (mk === thisMonthKey) countThisMonth++
      if (mk === prevMonthKey) countPrevMonth++
    }

    if (r.fecha_reserva) {
      const d = parseISO(r.fecha_reserva)
      if (isValid(d)) weekdayCounts[getDay(d)]++
    }
  }

  const total = reservas.length
  const cancelados = canc
  const activas = total - cancelados
  const healthyPct = total ? Math.round((activas / total) * 100) : 0

  const toSorted = (map) =>
    Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

  const end = startOfMonth(now)
  const start = subMonths(end, chartMonths - 1)
  const monthRange = eachMonthOfInterval({ start, end })

  const monthlyBars = monthRange.map((m) => {
    const key = format(m, 'yyyy-MM')
    const labelRaw = format(m, 'MMM', { locale: es }).replace('.', '')
    const bucket = monthBuckets[key] || { reservas: 0, uf: 0 }
    return {
      label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1),
      key,
      uf: bucket.uf,
      reservas: bucket.reservas,
      highlight: key === thisMonthKey,
    }
  })

  const sparkLast = monthlyBars.slice(-6)
  const avgMonthlyUF = monthlyBars.length
    ? monthlyBars.reduce((s, b) => s + b.uf, 0) / monthlyBars.length
    : 0
  const avgReservasMonth = monthlyBars.length
    ? monthlyBars.reduce((s, b) => s + b.reservas, 0) / monthlyBars.length
    : 0

  const curMonthBar = monthlyBars.find((b) => b.highlight)
  const prevMonthBar = monthlyBars[monthlyBars.length - 2]

  return {
    total,
    totalUF,
    futuraN,
    healthyPct,
    activas,
    cancelados,
    estadoCounts: { pend, apr, canc, other },
    countThisMonth,
    monthTrend: pctChange(countThisMonth, countPrevMonth),
    ufTrend: pctChange(curMonthBar?.uf ?? 0, prevMonthBar?.uf ?? 0),
    monthlyBars,
    sparkData: {
      values: sparkLast.map((b) => b.reservas),
      labels: sparkLast.map((b) => b.label.slice(0, 3)),
    },
    avgMonthlyUF,
    avgReservasMonth,
    inmob: toSorted(inmobMap),
    comunas: toSorted(comunaMap),
    tipos: toSorted(tipoMap),
    proyectos: toSorted(proyectoMap),
    weekdayCounts,
    thisMonthLabel: format(now, 'MMMM yyyy', { locale: es }),
    curMonthUf: curMonthBar?.uf ?? 0,
  }
}

export function useResumenMetrics(reservas, chartMonths) {
  return useMemo(() => computeResumenMetrics(reservas, chartMonths), [reservas, chartMonths])
}
