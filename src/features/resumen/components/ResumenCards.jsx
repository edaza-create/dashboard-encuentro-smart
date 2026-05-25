import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Check, Building2, MapPin, Layers, Briefcase } from 'lucide-react'
import { getDay, parseISO, isValid } from 'date-fns'
import MetricCard from './MetricCard.jsx'
import { shortLabel } from '../../../utils/reservaAggregates.js'
import { formatUF } from '../../../utils/format.js'
import { CHART_PALETTE, ESTADO_COLORS } from '../constants.js'
import styles from '../ResumenPage.module.css'

function SparkBars({ values, labels }) {
  const max = Math.max(...values, 1)
  return (
    <>
      <div className={styles.sparkBars} aria-hidden>
        {values.map((v, i) => (
          <div
            key={i}
            className={styles.sparkBar}
            style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      {labels?.length ? (
        <div className={styles.sparkLabels}>
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
    </>
  )
}

export function KpiHeroCard({ metrics }) {
  const { total, monthTrend, sparkData, inmob } = metrics
  const topInmob = inmob[0]
  return (
    <MetricCard
      featured
      title="Total reservas"
      subtitle="Ventana Cyber · Capital Open"
      metric={total.toLocaleString('es-CL')}
      delta={monthTrend.label}
      deltaDir={monthTrend.dir}
      footer={
        topInmob
          ? `Líder: ${shortLabel(topInmob.name, 30)} · ${topInmob.value.toLocaleString('es-CL')} reservas`
          : 'Sin datos de inmobiliaria'
      }
    >
      <SparkBars values={sparkData.values} labels={sparkData.labels} />
    </MetricCard>
  )
}

export function KpiPulseCards({ metrics }) {
  const { totalUF, ufTrend, countThisMonth, thisMonthLabel, futuraN, total } = metrics
  return (
    <>
      <MetricCard
        title="Cartera UF"
        subtitle="Valor planilla acumulado"
        metric={formatUF(Math.round(totalUF))}
        metricClass={styles.metricValueSm}
        delta={ufTrend.label}
        deltaDir={ufTrend.dir}
      />
      <MetricCard
        title="Mes en curso"
        subtitle={thisMonthLabel}
        metric={countThisMonth.toLocaleString('es-CL')}
        delta="altas del mes"
        deltaDir="neutral"
      />
      <MetricCard
        title="Entrega futura"
        subtitle="Unidades con entrega diferida"
        metric={futuraN.toLocaleString('es-CL')}
        delta={total ? `${Math.round((futuraN / total) * 100)}% del total` : '—'}
        deltaDir="neutral"
      />
    </>
  )
}

export function RankingInmobiliariaCard({ items, onDrillDown }) {
  if (!items.length) {
    return (
      <MetricCard title="Ranking inmobiliaria" subtitle="Top 5 por reservas" icon={Building2}>
        <p className={styles.empty}>Sin datos de inmobiliaria</p>
      </MetricCard>
    )
  }

  const leader = items[0]
  return (
    <MetricCard
      title="Ranking inmobiliaria"
      subtitle="Clic en fila para ver en Reservas"
      metric={leader.value.toLocaleString('es-CL')}
      delta="reservas del líder"
      deltaDir="up"
      icon={Building2}
    >
      <ul className={styles.rankList}>
        {items.slice(0, 5).map((row, i) => {
          const numCls =
            i === 0 ? styles.rankNumGold : i === 1 ? styles.rankNumSilver : i === 2 ? styles.rankNumBronze : ''
          const pctOfLeader = leader.value ? Math.round((row.value / leader.value) * 100) : 0
          return (
            <li key={row.name}>
              <button
                type="button"
                className={styles.rankRowBtn}
                title={`Ver reservas de ${row.name}`}
                onClick={() => onDrillDown?.({ type: 'search', value: row.name })}
              >
                <span className={`${styles.rankNum} ${numCls}`}>{i + 1}</span>
                <span className={styles.rankName}>{shortLabel(row.name, 22)}</span>
                <span className={styles.rankVal}>{row.value}</span>
                <span className={styles.rankDelta}>{i === 0 ? 'líder' : `${pctOfLeader}%`}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </MetricCard>
  )
}

export function GoalHealthCard({ metrics }) {
  const { healthyPct, activas, cancelados, total } = metrics
  const gaugeData = [
    { value: healthyPct, fill: healthyPct >= 70 ? '#48cfad' : healthyPct >= 45 ? '#ffce54' : '#ed5565' },
    { value: 100 - healthyPct, fill: 'rgba(255,255,255,0.2)' },
  ]

  return (
    <article className={`${styles.card} ${styles.cardFeatured} ${styles.goalCard}`}>
      <header className={styles.cardHead}>
        <div className={styles.cardHeadText}>
          <h3 className={styles.title}>Salud de cartera</h3>
          <p className={styles.sub}>Reservas no canceladas · meta operativa 70%+</p>
        </div>
      </header>
      <div className={styles.goalBody}>
        <div className={styles.goalLeft}>
          <div className={styles.metricRow}>
            <span className={styles.metricValue}>{healthyPct}%</span>
            <span className={`${styles.delta} ${styles.deltaUp}`} style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
              {healthyPct >= 70 ? 'En rango' : 'Revisar'}
            </span>
          </div>
          <p className={styles.goalFrac}>
            {activas.toLocaleString('es-CL')} / {total.toLocaleString('es-CL')} activas
          </p>
        </div>
        <div className={styles.goalDonut} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="88%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                {gaugeData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className={styles.goalFooter}>
        {cancelados.toLocaleString('es-CL')} cancelaciones en este conjunto
      </p>
    </article>
  )
}

export function WeekdayActivityCard({ weekdayCounts }) {
  const { cols, max } = useMemo(() => {
    const order = [1, 2, 3, 4, 5, 6, 0]
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    const fullLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const todayDow = getDay(new Date())
    const colsInner = order.map((dow, i) => ({
      dow,
      label: labels[i],
      full: fullLabels[i],
      count: weekdayCounts[dow],
      isToday: dow === todayDow,
    }))
    return { cols: colsInner, max: Math.max(...colsInner.map((c) => c.count), 1) }
  }, [weekdayCounts])

  const weekTotal = cols.reduce((s, c) => s + c.count, 0)

  return (
    <MetricCard
      title="Actividad semanal"
      subtitle="Distribución por día de la semana"
      metric={weekTotal.toLocaleString('es-CL')}
      delta={`Ø ${(weekTotal / 7).toFixed(1)}/día`}
      deltaDir="neutral"
    >
      <div className={styles.weekBars} role="img" aria-label="Barras de reservas por día de la semana">
        {cols.map((c) => {
          const h = Math.max(8, (c.count / max) * 88)
          const done = c.count >= max * 0.65 && c.count > 0
          return (
            <div key={c.dow} className={styles.weekCol} title={`${c.full}: ${c.count}`}>
              <div className={styles.weekCheck}>{done ? <Check size={14} strokeWidth={3} /> : null}</div>
              <div
                className={`${styles.weekBar} ${c.isToday ? styles.weekBarToday : done ? styles.weekBarDone : ''}`}
                style={{ height: h }}
              />
              <span className={`${styles.weekLabel} ${c.isToday ? styles.weekLabelToday : ''}`}>{c.label}</span>
            </div>
          )
        })}
      </div>
    </MetricCard>
  )
}

export function ProyectosCard({ proyectos, onDrillDown }) {
  const top = proyectos.slice(0, 5)
  if (!top.length) {
    return (
      <MetricCard title="Top proyectos" subtitle="Por cantidad de reservas">
        <p className={styles.empty}>Sin proyectos</p>
      </MetricCard>
    )
  }
  return (
    <MetricCard
      title="Top proyectos"
      subtitle="Clic para filtrar en Reservas"
      metric={top[0].value.toLocaleString('es-CL')}
      delta={shortLabel(top[0].name, 16)}
      deltaDir="neutral"
    >
      <ul className={styles.rankList}>
        {top.map((row, i) => (
          <li key={row.name}>
            <button
              type="button"
              className={styles.rankRowBtn}
              onClick={() => onDrillDown?.({ type: 'proyecto', value: row.name })}
            >
              <span className={`${styles.rankNum} ${i === 0 ? styles.rankNumGold : ''}`}>{i + 1}</span>
              <span className={styles.rankName}>{shortLabel(row.name, 26)}</span>
              <span className={styles.rankVal}>{row.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </MetricCard>
  )
}

export function ComunasCard({ comunas, total }) {
  const top = comunas.slice(0, 4)
  if (!top.length) {
    return (
      <MetricCard title="Comunas" subtitle="Distribución geográfica" icon={MapPin}>
        <p className={styles.empty}>Sin comuna registrada</p>
      </MetricCard>
    )
  }
  return (
    <MetricCard
      title="Comunas"
      subtitle="Principales ubicaciones"
      metric={top[0].value.toLocaleString('es-CL')}
      delta={`${total ? Math.round((top[0].value / total) * 100) : 0}% del total`}
      deltaDir="up"
      icon={MapPin}
    >
      <div className={styles.categoryPills}>
        {top.map((c) => (
          <div key={c.name} className={styles.categoryPill}>
            <span title={c.name}>{shortLabel(c.name, 24)}</span>
            <span>
              {c.value} · {total ? Math.round((c.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </MetricCard>
  )
}

export function TipologiasCard({ tipos, total }) {
  const { segments, row, empty } = useMemo(() => {
    if (!tipos.length || !total) return { segments: [], row: null, empty: true }
    const top = tipos.slice(0, 5)
    const rest = tipos.slice(5).reduce((s, x) => s + x.value, 0)
    const parts = [...top]
    if (rest > 0) parts.push({ name: 'Otros', value: rest })
    const t = parts.reduce((s, p) => s + p.value, 0) || 1
    const pcts = parts.map((p) => Math.round((p.value / t) * 1000) / 10)
    const rowInner = { id: 'mix' }
    const segs = parts.map((p, i) => {
      const key = `s${i}`
      rowInner[key] = pcts[i]
      return { key, name: p.name, pct: pcts[i], color: CHART_PALETTE[i % CHART_PALETTE.length] }
    })
    return { segments: segs, row: rowInner, empty: false }
  }, [tipos, total])

  if (empty) {
    return (
      <MetricCard title="Tipologías" subtitle="Mix de producto" icon={Layers}>
        <p className={styles.empty}>Sin tipologías</p>
      </MetricCard>
    )
  }

  return (
    <MetricCard
      title="Tipologías"
      subtitle="Mix de reservas"
      metric={`${segments[0]?.pct ?? 0}%`}
      delta={shortLabel(segments[0]?.name, 14)}
      deltaDir="neutral"
      icon={Layers}
    >
      <div className={styles.chartShort}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[row]} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="id" hide width={0} />
            {segments.map((seg, i) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                stackId="mix"
                fill={seg.color}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={0.5}
                radius={
                  i === 0 ? [10, 0, 0, 10] : i === segments.length - 1 ? [0, 10, 10, 0] : [0, 0, 0, 0]
                }
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.stackLegendRows}>
        {segments.slice(0, 4).map((seg) => (
          <div key={seg.key} className={styles.categoryPill}>
            <span>
              <span className={styles.legendDot} style={{ background: seg.color }} />
              {shortLabel(seg.name, 20)}
            </span>
            <span>{seg.pct}%</span>
          </div>
        ))}
      </div>
    </MetricCard>
  )
}

export function EstadoStackCard({ estadoCounts, total, onDrillDown }) {
  const segments = useMemo(() => {
    const items = [
      { key: 'apr', label: 'Aprobado', value: estadoCounts.apr, color: ESTADO_COLORS.Aprobado },
      { key: 'pend', label: 'Pendiente', value: estadoCounts.pend, color: ESTADO_COLORS.Pendiente },
      { key: 'canc', label: 'Cancelado', value: estadoCounts.canc, color: ESTADO_COLORS.Cancelado },
      { key: 'other', label: 'Otro', value: estadoCounts.other, color: ESTADO_COLORS.Otro },
    ].filter((x) => x.value > 0)
    const t = total || 1
    return items.map((x) => ({ ...x, pct: (x.value / t) * 100 }))
  }, [estadoCounts, total])

  return (
    <MetricCard
      title="Estado de reservas"
      subtitle="Clic en leyenda para filtrar"
      metric={total.toLocaleString('es-CL')}
      delta={`${estadoCounts.apr} aprob.`}
      deltaDir="up"
      icon={Briefcase}
    >
      <div className={styles.stackBar} role="img" aria-label="Barra de estados">
        {segments.map((s) => (
          <div
            key={s.key}
            className={styles.stackSeg}
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className={styles.stackLegend}>
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            className={styles.stackLegendBtn}
            onClick={() => onDrillDown?.({ type: 'estado', value: s.label })}
          >
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label} <strong>{s.value}</strong>
          </button>
        ))}
      </div>
    </MetricCard>
  )
}
