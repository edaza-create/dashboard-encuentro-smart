import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'
import { format, eachMonthOfInterval, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Minus, MoreHorizontal } from 'lucide-react'
import styles from './DashboardOverview.module.css'
import { formatUF } from '../utils/format'
import { ufMontoPlanillaReserva } from '../utils/ufNormalize'

const C = {
  blue: '#5d9cec',
  blueLight: '#a0d4ff',
  yellow: '#ffce54',
  green: '#48cfad',
  violet: '#ac92ec',
  red: '#ed5565',
  barMuted: '#e4eaf4',
}

const TIPO_COLORS = [C.blue, C.blueLight, C.violet, C.green, C.yellow]

function CustomTooltip({ active, payload, label }) {
  if (active && payload?.length) {
    return (
      <div className={styles.tooltip}>
        {label != null && <p className={styles.tooltipLabel}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || C.blue }}>
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString('es-CL') : p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

function monthKeyFromReserva(fecha) {
  if (!fecha || typeof fecha !== 'string') return null
  return fecha.slice(0, 7)
}

function KpiCard({ label, value, trend, trendDir, trendFoot }) {
  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {trend != null && trend !== '' && (
        <div
          className={`${styles.kpiTrend} ${
            trendDir === 'up' ? styles.kpiTrendUp : trendDir === 'down' ? styles.kpiTrendDown : styles.kpiTrendFlat
          }`}
        >
          <TrendIcon size={13} strokeWidth={2.5} />
          {trend}
        </div>
      )}
      {trendFoot && <div className={styles.kpiFoot}>{trendFoot}</div>}
    </div>
  )
}

export default function DashboardOverview({ reservas }) {
  const now = new Date()
  const total = reservas.length
  const totalUF = useMemo(() => reservas.reduce((s, r) => s + ufMontoPlanillaReserva(r), 0), [reservas])

  const [chartMonths, setChartMonths] = useState(6)

  const thisMonthKey = format(startOfMonth(now), 'yyyy-MM')
  const prevMonthKey = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM')

  const countThisMonth = useMemo(
    () => reservas.filter((r) => monthKeyFromReserva(r.fecha_reserva) === thisMonthKey).length,
    [reservas, thisMonthKey]
  )
  const countPrevMonth = useMemo(
    () => reservas.filter((r) => monthKeyFromReserva(r.fecha_reserva) === prevMonthKey).length,
    [reservas, prevMonthKey]
  )

  const monthTrend = useMemo(() => {
    if (countPrevMonth === 0) {
      if (countThisMonth > 0) return { pct: null, label: 'nuevo', dir: 'up' }
      return { pct: 0, label: '0%', dir: 'flat' }
    }
    const pct = Math.round(((countThisMonth - countPrevMonth) / countPrevMonth) * 100)
    return {
      pct: Math.abs(pct),
      label: `${pct >= 0 ? '+' : ''}${pct}%`,
      dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    }
  }, [countThisMonth, countPrevMonth])

  const monthRange = useMemo(() => {
    const end = startOfMonth(new Date())
    const start = subMonths(end, chartMonths - 1)
    return eachMonthOfInterval({ start, end })
  }, [chartMonths])

  const monthlyBars = useMemo(() => {
    return monthRange.map((m) => {
      const key = format(m, 'yyyy-MM')
      const label = format(m, 'MMM', { locale: es }).replace('.', '')
      const inMonth = reservas.filter((r) => monthKeyFromReserva(r.fecha_reserva) === key)
      const uf = inMonth.reduce((s, r) => s + ufMontoPlanillaReserva(r), 0)
      return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        key,
        uf,
        highlight: key === thisMonthKey,
      }
    })
  }, [reservas, thisMonthKey, monthRange])

  const avgMonthlyUF = useMemo(() => {
    if (!monthlyBars.length) return 0
    const sum = monthlyBars.reduce((s, b) => s + b.uf, 0)
    return sum / monthlyBars.length
  }, [monthlyBars])

  const topTipologia = useMemo(() => {
    const acc = {}
    for (const r of reservas) {
      const k = r.tipologia || 'Sin tipología'
      acc[k] = (acc[k] || 0) + 1
    }
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [reservas])

  const tipologiaTotal = topTipologia.reduce((s, x) => s + x.value, 0) || 1

  const topProyectos = useMemo(() => {
    const acc = {}
    for (const r of reservas) {
      const k = (r.proyecto && String(r.proyecto).trim()) || 'Sin proyecto'
      acc[k] = (acc[k] || 0) + 1
    }
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [reservas])

  const estadoCounts = useMemo(() => {
    let pend = 0
    let apr = 0
    let canc = 0
    let other = 0
    for (const r of reservas) {
      const e = r.estado
      if (e === 'Pendiente') pend++
      else if (e === 'Aprobado') apr++
      else if (e === 'Cancelado') canc++
      else other++
    }
    return { pend, apr, canc, other }
  }, [reservas])

  const cancelados = estadoCounts.canc
  const healthyPct = total ? Math.round(((total - cancelados) / total) * 100) : 0
  const gaugeActiveColor = healthyPct >= 70 ? C.green : healthyPct >= 45 ? C.yellow : C.red
  const gaugeData = [
    { name: 'Activas', value: healthyPct, fill: gaugeActiveColor },
    { name: 'Resto', value: 100 - healthyPct, fill: '#e8ecf4' },
  ]

  const areaSeries = useMemo(() => {
    return monthRange.map((m) => {
      const key = format(m, 'yyyy-MM')
      const label = format(m, 'MMM', { locale: es }).replace('.', '')
      const count = reservas.filter((r) => monthKeyFromReserva(r.fecha_reserva) === key).length
      return {
        m: label.charAt(0).toUpperCase() + label.slice(1),
        key,
        reservas: count,
        highlight: key === thisMonthKey,
      }
    })
  }, [reservas, thisMonthKey, monthRange])

  const avgReservasMonth = useMemo(() => {
    if (!areaSeries.length) return 0
    const s = areaSeries.reduce((a, b) => a + b.reservas, 0)
    return s / areaSeries.length
  }, [areaSeries])

  const maxBar = Math.max(...monthlyBars.map((b) => b.uf), 1)
  const futuraN = reservas.filter((r) => r.tipo_entrega === 'futura').length

  const trendLine =
    monthTrend.pct == null && monthTrend.label === 'nuevo'
      ? 'Nuevo'
      : monthTrend.dir === 'flat'
        ? monthTrend.label
        : `${monthTrend.label}`

  const chartPills = [
    { m: 3, label: '3 meses' },
    { m: 6, label: '6 meses' },
    { m: 12, label: '12 meses' },
  ]

  return (
    <div className={styles.shell}>
      <div className={styles.kpiRow}>
        <KpiCard
          label="Total reservas"
          value={total.toLocaleString('es-CL')}
          trend={trendLine}
          trendDir={monthTrend.dir}
          trendFoot="vs mes anterior (altas)"
        />
        <KpiCard
          label="Cartera UF"
          value={formatUF(Math.round(totalUF))}
          trend={null}
          trendDir="flat"
          trendFoot="Suma valor planilla"
        />
        <KpiCard
          label="Salud cartera"
          value={`${healthyPct}%`}
          trend={healthyPct >= 70 ? 'Estable' : 'Revisar'}
          trendDir={healthyPct >= 70 ? 'up' : 'flat'}
          trendFoot="Sin cancelar"
        />
        <KpiCard
          label="Pendientes"
          value={estadoCounts.pend.toLocaleString('es-CL')}
          trend={null}
          trendDir="flat"
          trendFoot="Estado pendiente"
        />
        <KpiCard
          label="Aprobados"
          value={estadoCounts.apr.toLocaleString('es-CL')}
          trend={null}
          trendDir="flat"
          trendFoot="En cartera filtrada"
        />
        <KpiCard
          label="Entrega futura"
          value={futuraN.toLocaleString('es-CL')}
          trend={null}
          trendDir="flat"
          trendFoot="tipo_entrega = futura"
        />
      </div>

      <div className={styles.midRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Cartera UF por mes</h2>
              <p className={styles.cardSub}>Evolución del monto en UF según fecha de reserva</p>
            </div>
            <div className={styles.cardHeadRight}>
              <div className={styles.pills} role="tablist" aria-label="Ventana del gráfico">
                {chartPills.map(({ m, label }) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={chartMonths === m}
                    className={`${styles.pill} ${chartMonths === m ? styles.pillActive : ''}`}
                    onClick={() => setChartMonths(m)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.menuBtn} aria-label="Más opciones">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
          <div className={styles.chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBars} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8b92a5', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, maxBar * 1.12]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(93,156,236,0.06)' }} />
                <ReferenceLine
                  y={avgMonthlyUF}
                  stroke="#b8c4d9"
                  strokeDasharray="5 5"
                  label={{
                    value: `Prom ${formatUF(Math.round(avgMonthlyUF))}`,
                    position: 'insideTopRight',
                    fill: '#1a1d26',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="uf" name="UF mes" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {monthlyBars.map((entry, i) => (
                    <Cell key={i} fill={entry.highlight ? C.blue : C.barMuted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Salud operativa</h2>
              <p className={styles.cardSub}>Reservas activas vs canceladas</p>
            </div>
            <button type="button" className={styles.menuBtn} aria-label="Más opciones">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className={styles.gaugeBlock}>
            <div className={styles.gaugeChart}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={68}
                    outerRadius={92}
                    dataKey="value"
                    stroke="none"
                  >
                    {gaugeData.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore}>{healthyPct}%</div>
                <div className={`${styles.gaugeBadge} ${healthyPct >= 70 ? styles.gaugeBadgeOk : styles.gaugeBadgeWarn}`}>
                  {healthyPct >= 70 ? 'En rango' : 'Atención'}
                </div>
              </div>
            </div>
            <p className={styles.gaugeNote}>
              {healthyPct}% de las reservas no están canceladas. {estadoCounts.canc.toLocaleString('es-CL')}{' '}
              cancelaciones en este conjunto.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Reservas en el tiempo</h2>
            <p className={styles.cardSub}>Altas por mes (misma ventana que el gráfico de UF)</p>
          </div>
          <button type="button" className={styles.menuBtn} aria-label="Más opciones">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className={styles.areaMeta}>
          <span className={styles.areaTotal}>{total.toLocaleString('es-CL')} reservas</span>
          <span className={styles.areaAvg}>Promedio {avgReservasMonth.toFixed(1)} / mes en vista</span>
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaSeries} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="fillAreaDash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="m"
                tick={({ x, y, payload }) => {
                  const isHi = areaSeries.find((d) => d.m === payload.value)?.highlight
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {isHi && <rect x={-22} y={0} width={44} height={22} rx={11} fill={C.blue} />}
                      <text
                        textAnchor="middle"
                        fill={isHi ? '#fff' : '#8b92a5'}
                        fontSize={11}
                        fontWeight={600}
                        dy={14}
                      >
                        {payload.value}
                      </text>
                    </g>
                  )
                }}
                axisLine={false}
                tickLine={false}
                height={36}
              />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={avgReservasMonth}
                stroke="#b8c4d9"
                strokeDasharray="5 5"
                label={{
                  value: `Prom ${avgReservasMonth.toFixed(1)}`,
                  position: 'insideTopRight',
                  fill: '#1a1d26',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <Area
                type="monotone"
                dataKey="reservas"
                name="Reservas"
                stroke={C.blue}
                strokeWidth={2.5}
                fill="url(#fillAreaDash)"
                dot={{ r: 3, fill: C.blue, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.tableRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Resumen por estado</h2>
              <p className={styles.cardSub}>Conteos en el período filtrado</p>
            </div>
            <button type="button" className={styles.menuBtn} aria-label="Más opciones">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pendiente</td>
                <td>{estadoCounts.pend.toLocaleString('es-CL')}</td>
              </tr>
              <tr>
                <td>Aprobado</td>
                <td>{estadoCounts.apr.toLocaleString('es-CL')}</td>
              </tr>
              <tr>
                <td>Cancelado</td>
                <td>{estadoCounts.canc.toLocaleString('es-CL')}</td>
              </tr>
              <tr>
                <td>Otro / sin clasificar</td>
                <td>{estadoCounts.other.toLocaleString('es-CL')}</td>
              </tr>
              <tr className={styles.tableStrong}>
                <td>Total</td>
                <td>{total.toLocaleString('es-CL')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Mix tipológico</h2>
              <p className={styles.cardSub}>Participación por categoría</p>
            </div>
            <button type="button" className={styles.menuBtn} aria-label="Más opciones">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipología</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {(topTipologia.length ? topTipologia : [{ name: 'Sin datos', value: 0 }]).map((row, i) => (
                <tr key={row.name}>
                  <td>
                    <span className={styles.tdCell}>
                      <span className={styles.dot} style={{ background: TIPO_COLORS[i % TIPO_COLORS.length] }} />
                      {row.name}
                    </span>
                  </td>
                  <td>
                    {topTipologia.length
                      ? `${Math.round((row.value / tipologiaTotal) * 100)}% · ${row.value.toLocaleString('es-CL')}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Top proyectos</h2>
            <p className={styles.cardSub}>Ranking por cantidad de reservas</p>
          </div>
          <button type="button" className={styles.menuBtn} aria-label="Más opciones">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Reservas</th>
            </tr>
          </thead>
          <tbody>
            {topProyectos.length === 0 ? (
              <tr>
                <td colSpan={2} className={styles.tableEmpty}>
                  Sin datos de proyecto
                </td>
              </tr>
            ) : (
              topProyectos.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.value.toLocaleString('es-CL')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
