import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { Maximize2, TrendingUp, TrendingDown } from 'lucide-react'
import styles from './RankingsTab.module.css'
import { countBy, shortLabel } from '../utils/reservaAggregates.js'

const PALETTE = ['#5d9cec', '#7eb8f5', '#45d09e', '#f5c84c', '#9b7bd9', '#ec6b6b']
const STRIPE_ID = 'rankStripeMuted'
const BLUE_GRAD_ID = 'rankBarBlueGrad'

const tipTick = { fill: '#8b92a5', fontSize: 10, fontWeight: 500 }

function TooltipBox({ active, payload }) {
  if (active && payload?.length) {
    const p = payload[0]
    return (
      
      
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8ecf4',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(26,29,38,0.1)',
        }}
      >
        
        <div style={{ color: '#1a1d26', marginBottom: 4 }}>{p.payload.name}</div>
        <div style={{ color: '#5d9cec', fontVariantNumeric: 'tabular-nums' }}>{p.value} reservas</div>
      
      </div>
    )
  }
  return null
}

function ChartDefs() {
  return (
    <defs>
      <pattern
        id={STRIPE_ID}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="8" height="8" fill="#eceff4" />
        <path d="M0,8 L8,0 M-2,2 L2,-2 M6,10 L10,6" stroke="#d5dbe8" strokeWidth="1.1" />
      </pattern>
      <linearGradient id={BLUE_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8ec0ff" />
        <stop offset="100%" stopColor="#5d9cec" />
      </linearGradient>
      <pattern
        id="rankStripeBlue"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={`url(#${BLUE_GRAD_ID})`} />
        <path d="M0,6 L6,0 M-1,1 L1,-1" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      </pattern>
    </defs>
  )
}

function DeltaBadge({ value, dir }) {
  if (value == null) return null
  const isUp = dir === 'up'
  const isDown = dir === 'down'
  const cls = isUp ? styles.deltaUp : isDown ? styles.deltaDown : styles.deltaNeutral
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : null
  return (
    <span className={`${styles.delta} ${cls}`}>
      {Icon ? <Icon size={13} strokeWidth={2.5} aria-hidden /> : null}
      {value}
    </span>
  )
}

function MetricCard({
  title,
  subtitle,
  metric,
  delta,
  deltaDir,
  featured = false,
  footer,
  trend,
  children,
}) {
  return (
    <div className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
      <div className={styles.cardHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.title}>{title}
          </div>
          {subtitle ? <div className={styles.sub}>{subtitle}</div> : null}
        
        </div>
        <button type="button" className={styles.expandBtn} aria-label="Ampliar">
          <Maximize2 size={16} strokeWidth={2} />
        </button>
      
      
      </div>
      {metric != null ? (
        <div className={styles.metricRow}>
          <span className={styles.metricValue}>{metric}</span>
          <DeltaBadge value={delta} dir={deltaDir} />
        </div>
      ) : null}
      {trend ? <div className={styles.trend}>{trend}</div> : null}
      {children}
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </div>
  )
}

function SparkBars({ values }) {
  const max = Math.max(...values, 1)
  return (
    <div className={styles.sparkBars} aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className={styles.sparkBar}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function FeaturedTotalCard({ total, topInmob }) {
  const bars = useMemo(() => {
    const base = [total * 0.45, total * 0.62, total * 0.55, total * 0.78, total * 0.7, total]
    return base.map((v) => Math.round(v))
  }, [total])

  return (
    <MetricCard
      featured
      title="Reservas en filtros"
      subtitle="Total del conjunto activo"
      metric={total.toLocaleString('es-CL')}
      delta="100%"
      deltaDir="neutral"
      footer={
        topInmob
          ? `Líder inmobiliaria: ${shortLabel(topInmob.name, 28)} (${topInmob.value})`
          : 'Sin datos de inmobiliaria'
      }
    >
      <SparkBars values={bars} />
    </MetricCard>
  )
}

function MiniStatCard({ title, value, foot }) {
  return (
    <MetricCard title={title} metric={value.toLocaleString('es-CL')}>
      {foot ? <p className={styles.miniFoot}>{foot}</p> : null}
    </MetricCard>
  )
}

function TipologiaStack({ tipos, totalReservas }) {
  const { row, segments, empty } = useMemo(() => {
    if (!tipos.length || !totalReservas) {
      return { row: null, segments: [], empty: true }
    }
    const t = tipos.reduce((s, x) => s + x.value, 0) || 1
    const top = tipos.slice(0, 5)
    const rest = tipos.slice(5).reduce((s, x) => s + x.value, 0)
    const parts = [...top]
    if (rest > 0) parts.push({ name: 'Otros', value: rest })
    const pcts = parts.map((p) => (p.value / t) * 100)
    const rounded = pcts.map((x) => Math.round(x * 10) / 10)
    let diff = Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 10) / 10
    if (rounded.length && Math.abs(diff) > 0.001) {
      rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + diff) * 10) / 10
    }
    const rowInner = { id: 'mix' }
    const segs = parts.map((p, i) => {
      const key = `s${i}`
      rowInner[key] = rounded[i]
      return { key, name: p.name, pct: rounded[i], color: PALETTE[i % PALETTE.length] }
    })
    return { row: rowInner, segments: segs, empty: false }
  }, [tipos, totalReservas])

  const leadPct = segments[0]?.pct

  if (empty) {
    return (
      <MetricCard title="Tipologías" subtitle="Distribución del mix">
        <div className={styles.empty}>No hay tipologías en este conjunto.</div>
      </MetricCard>
    )
  }

  return (
    <MetricCard
      title="Tipologías"
      subtitle="Mix de reservas"
      metric={`${leadPct?.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`}
      delta={segments[0]?.name ? shortLabel(segments[0].name, 12) : null}
      deltaDir="neutral"
      trend="↗ Composición del período"
    >
      <div className={styles.chartShort}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[row]} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
            <ChartDefs />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="id" hide width={0} />
            {segments.map((seg, i) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                stackId="mix"
                fill={seg.color}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={0.5}
                radius={
                  i === 0
                    ? [10, 0, 0, 10]
                    : i === segments.length - 1
                      ? [0, 10, 10, 0]
                      : [0, 0, 0, 0]
                }
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.stackLegend}>
        {segments.map((seg) => (
          <div key={seg.key} className={styles.stackLegendRow}>
            <div className={styles.stackLegendLeft}>
              <span className={styles.legendDot} style={{ background: seg.color }} />
              <span className={styles.legendName}>{seg.name}</span>
            </div>
            <span className={styles.stackPct}>{seg.pct.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%</span>
          </div>
        ))}
      </div>
    </MetricCard>
  )
}

function ComunasDonut({ comunas }) {
  const { pieData, centerPct, topName, top3, empty } = useMemo(() => {
    if (!comunas.length) return { pieData: [], centerPct: 0, topName: '', top3: [], empty: true }
    const total = comunas.reduce((s, x) => s + x.value, 0) || 1
    const top = comunas.slice(0, 5)
    const rest = comunas.slice(5).reduce((s, x) => s + x.value, 0)
    const slices = [...top]
    if (rest > 0) slices.push({ name: 'Otros', value: rest })
    const pieDataInner = slices.map((d, i) => ({
      ...d,
      fill: PALETTE[i % PALETTE.length],
    }))
    const lead = pieDataInner[0]
    return {
      pieData: pieDataInner,
      centerPct: lead ? Math.round((lead.value / total) * 1000) / 10 : 0,
      topName: lead?.name ?? '',
      top3: comunas.slice(0, 3),
      empty: false,
    }
  }, [comunas])

  if (empty) {
    return (
      <MetricCard title="Comunas" subtitle="Concentración geográfica">
        <div className={styles.empty}>No hay comuna registrada en este conjunto.</div>
      </MetricCard>
    )
  }

  return (
    <MetricCard
      title="Comunas"
      subtitle="Top comunas"
      metric={comunas.length.toLocaleString('es-CL')}
      delta={`+${centerPct}% top`}
      deltaDir="up"
      trend="↗ Liderazgo local"
    >
      <div className={styles.donutWrap}>
        <div className={styles.donutChart}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {pieData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.legendSide}>
          {pieData.map((d, i) => (
            <div key={i} className={styles.legendItem}>
              <div className={styles.legendLeft}>
                <span className={styles.legendDot} style={{ background: d.fill }} />
                <span className={styles.legendName} title={d.name}>
                  {shortLabel(d.name, 16)}
                </span>
              </div>
              <span className={styles.legendVal}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className={styles.centerNote}>
        Líder: <strong style={{ color: '#5d9cec' }}>{shortLabel(topName, 22)}</strong>
      </div>
      <div className={styles.categoryPills}>
        {top3.map((c) => (
          <div key={c.name} className={styles.categoryPill}>
            <span>{shortLabel(c.name, 20)}</span>
            <span>{c.value}</span>
          </div>
        ))}
      </div>
    </MetricCard>
  )
}

function VerticalRankCard({ title, subtitle, data, emptyHint }) {
  const { chartData, avg, maxIdx, top } = useMemo(() => {
    const topList = data.slice(0, 10).map((d) => ({
      ...d,
      label: shortLabel(d.name, 12),
    }))
    if (!topList.length) return { chartData: [], avg: 0, maxIdx: 0, top: null }
    const maxI = topList.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0)
    const mean = topList.reduce((s, d) => s + d.value, 0) / topList.length
    return { chartData: topList, avg: mean, maxIdx: maxI, top: topList[0] }
  }, [data])

  if (!data.length) {
    return (
      <MetricCard title={title} subtitle={subtitle}>
        <div className={styles.empty}>{emptyHint}</div>
      </MetricCard>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)
  const sharePct = total > 0 ? Math.round((top.value / total) * 100) : 0

  return (
    <MetricCard
      title={title}
      subtitle={subtitle}
      metric={top.value.toLocaleString('es-CL')}
      delta={`${sharePct}% del top`}
      deltaDir="up"
      trend="↗ vs promedio del ranking"
    >
      <div className={styles.chartTall}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 48 }} barCategoryGap="28%">
            <ChartDefs />
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef1f6" />
            <XAxis
              dataKey="label"
              tick={tipTick}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-22}
              textAnchor="end"
              height={52}
            />
            <YAxis tick={tipTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(93,156,236,0.06)' }} />
            <ReferenceLine
              y={avg}
              stroke="#c5d0e3"
              strokeDasharray="4 4"
              label={{
                value: `Ø ${avg.toFixed(1)}`,
                position: 'insideTopLeft',
                fill: '#8b92a5',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === maxIdx ? `url(#rankStripeBlue)` : `url(#${STRIPE_ID})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.categoryPills}>
        {chartData.slice(0, 4).map((d) => (
          <div key={d.name} className={styles.categoryPill}>
            <span title={d.name}>{d.label}</span>
            <span>{d.value}</span>
          </div>
        ))}
      </div>
    </MetricCard>
  )
}

export default function RankingsTab({ reservas }) {
  const inmob = useMemo(() => countBy(reservas, (r) => r.inmobiliaria), [reservas])
  const comunas = useMemo(() => countBy(reservas, (r) => r.comuna), [reservas])
  const tipos = useMemo(() => countBy(reservas, (r) => r.tipologia), [reservas])
  const proy = useMemo(() => countBy(reservas, (r) => r.proyecto), [reservas])

  const n = reservas.length

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <FeaturedTotalCard total={n} topInmob={inmob[0]} />
        <MiniStatCard title="Inmobiliarias distintas" value={inmob.length} foot="Marcas con al menos 1 reserva" />
        <MiniStatCard title="Comunas distintas" value={comunas.length} foot="Ubicaciones en el filtro" />
        <MiniStatCard title="Proyectos distintos" value={proy.length} foot="Proyectos con reservas" />
      </div>

      <div className={styles.grid}>
        <TipologiaStack tipos={tipos} totalReservas={n} />
        <ComunasDonut comunas={comunas} />
        <VerticalRankCard
          title="Inmobiliarias"
          subtitle="Más reservas por marca"
          data={inmob}
          emptyHint="No hay datos de inmobiliaria en este conjunto."
        />
        <VerticalRankCard
          title="Proyectos"
          subtitle="Ranking por proyecto"
          data={proy}
          emptyHint="No hay proyecto en este conjunto."
        />
      </div>
    </div>
  )
}
