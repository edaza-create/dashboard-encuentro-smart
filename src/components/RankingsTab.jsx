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
import { Building2, MapPin, LayoutGrid, Layers, MoreHorizontal } from 'lucide-react'
import styles from './RankingsTab.module.css'

const PALETTE = ['#5d9cec', '#7eb8f5', '#f5c84c', '#45d09e', '#9b7bd9', '#ec6b6b']
const STRIPE_ID = 'rankStripeMuted'
const BLUE_GRAD_ID = 'rankBarBlueGrad'

const tipTick = { fill: '#8b92a5', fontSize: 10, fontWeight: 500 }

function countBy(reservas, accessor) {
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

function shortLabel(s, max = 14) {
  const t = String(s).trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

function TooltipBox({ active, payload }) {
  if (active && payload?.length) {
    const p = payload[0]
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8ecf4',
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ color: '#1a1d26', marginBottom: 2 }}>{p.payload.name}</div>
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
        <path
          d="M0,8 L8,0 M-2,2 L2,-2 M6,10 L10,6"
          stroke="#d5dbe8"
          strokeWidth="1.1"
        />
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

function MetricCard({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <div className={styles.iconBox} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={styles.title}>{title}</div>
            {subtitle ? <div className={styles.sub}>{subtitle}</div> : null}
          </div>
        </div>
        <button type="button" className={styles.menuBtn} aria-label="Opciones de tarjeta">
          <MoreHorizontal size={18} />
        </button>
      </div>
      {footer ? <div className={styles.trend}>{footer}</div> : null}
      {children}
    </div>
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

  if (empty) {
    return (
      <MetricCard icon={LayoutGrid} title="Tipologías" subtitle="Distribución del mix">
        <div className={styles.empty}>No hay tipologías en este conjunto.</div>
      </MetricCard>
    )
  }

  return (
    <MetricCard
      icon={LayoutGrid}
      title="Tipologías"
      subtitle="Mix de reservas (barra apilada)"
      footer="↗ Mix según filtros activos"
    >
      <div className={styles.chartShort}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[row]} margin={{ left: 0, right: 0, top: 6, bottom: 6 }}>
            <ChartDefs />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="id" hide width={0} />
            {segments.map((seg, i) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                stackId="mix"
                fill={seg.color}
                stroke="rgba(255,255,255,0.25)"
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
  const { pieData, centerPct, topName, empty } = useMemo(() => {
    if (!comunas.length) return { pieData: [], centerPct: 0, topName: '', empty: true }
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
      empty: false,
    }
  }, [comunas])

  if (empty) {
    return (
      <MetricCard icon={MapPin} title="Comunas" subtitle="Concentración geográfica">
        <div className={styles.empty}>No hay comuna registrada en este conjunto.</div>
      </MetricCard>
    )
  }

  return (
    <MetricCard icon={MapPin} title="Comunas" subtitle="Top comunas + leyenda" footer="↗ Liderazgo local">
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
        {topName ? (
          <>
            <strong style={{ color: 'var(--color-primary)' }}>{centerPct}%</strong> — líder: {shortLabel(topName, 22)}
          </>
        ) : null}
      </div>
    </MetricCard>
  )
}

function VerticalRankCard({ title, subtitle, data, emptyHint, icon: Icon }) {
  const { chartData, avg, maxIdx } = useMemo(() => {
    const top = data.slice(0, 10).map((d) => ({
      ...d,
      label: shortLabel(d.name, 12),
    }))
    if (!top.length) return { chartData: [], avg: 0, maxIdx: 0 }
    const maxI = top.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0)
    const mean = top.reduce((s, d) => s + d.value, 0) / top.length
    return { chartData: top, avg: mean, maxIdx: maxI }
  }, [data])

  if (!data.length) {
    return (
      <MetricCard icon={Icon} title={title} subtitle={subtitle}>
        <div className={styles.empty}>{emptyHint}</div>
      </MetricCard>
    )
  }

  return (
    <MetricCard icon={Icon} title={title} subtitle={subtitle} footer="↗ vs promedio del top 10">
      <div className={styles.chartTall}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 18, right: 12, left: 4, bottom: 52 }}>
            <ChartDefs />
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef1f6" />
            <XAxis
              dataKey="label"
              tick={tipTick}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-24}
              textAnchor="end"
              height={56}
            />
            <YAxis tick={tipTick} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(93,156,236,0.06)' }} />
            <ReferenceLine
              y={avg}
              stroke="#b8c4d9"
              strokeDasharray="5 5"
              label={{
                value: `Prom ${avg.toFixed(1)}`,
                position: 'insideTopLeft',
                fill: '#1a1d26',
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === maxIdx ? `url(#rankStripeBlue)` : `url(#${STRIPE_ID})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
      <p className={styles.intro}>
        Conteos según los filtros activos ({n.toLocaleString('es-CL')} reserva{n === 1 ? '' : 's'}). Estilo de
        tarjetas analíticas: barra apilada, donut y barras con textura.
      </p>
      <div className={styles.grid}>
        <TipologiaStack tipos={tipos} totalReservas={n} />
        <ComunasDonut comunas={comunas} />
        <VerticalRankCard
          icon={Building2}
          title="Inmobiliarias"
          subtitle="Más reservas por marca"
          data={inmob}
          emptyHint="No hay datos de inmobiliaria en este conjunto."
        />
        <VerticalRankCard
          icon={Layers}
          title="Proyectos"
          subtitle="Ranking por proyecto"
          data={proy}
          emptyHint="No hay proyecto en este conjunto."
        />
      </div>
    </div>
  )
}
