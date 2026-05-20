import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { formatUF } from '../../../utils/format.js'
import { CHART_BLUE, CHART_MONTH_OPTIONS } from '../constants.js'
import styles from '../ResumenPage.module.css'

function ChartTooltip({ active, payload, label, isUf }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className={styles.tooltip}>
      {label != null && <p className={styles.tooltipLabel}>{label}</p>}
      <p style={{ color: CHART_BLUE, margin: 0 }}>
        <strong>{isUf ? formatUF(Math.round(val)) : val?.toLocaleString('es-CL')}</strong>
        {!isUf ? ' reservas' : ''}
      </p>
    </div>
  )
}

export default function TrendChartCard({ metrics, chartMonths, onChartMonthsChange }) {
  const [mode, setMode] = useState('uf')
  const isUf = mode === 'uf'
  const dataKey = isUf ? 'uf' : 'reservas'
  const { monthlyBars, total, totalUF, avgMonthlyUF, avgReservasMonth } = metrics

  return (
    <article className={`${styles.card} ${styles.trendCard}`}>
      <header className={styles.trendHead}>
        <div>
          <h2 className={styles.trendTitle}>Tendencia mensual</h2>
          <p className={styles.sub}>Según fecha de reserva · ventana {chartMonths} meses</p>
        </div>
        <div className={styles.trendControls}>
          <div className={styles.trendTabs} role="tablist" aria-label="Métrica temporal">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'reservas'}
              className={`${styles.trendTab} ${mode === 'reservas' ? styles.trendTabActive : ''}`}
              onClick={() => setMode('reservas')}
            >
              Reservas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'uf'}
              className={`${styles.trendTab} ${mode === 'uf' ? styles.trendTabActive : ''}`}
              onClick={() => setMode('uf')}
            >
              UF
            </button>
          </div>
          <div className={styles.pills} role="tablist" aria-label="Ventana temporal">
            {CHART_MONTH_OPTIONS.map(({ m, label }) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={chartMonths === m}
                className={`${styles.pill} ${chartMonths === m ? styles.pillActive : ''}`}
                onClick={() => onChartMonthsChange(m)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className={styles.areaMeta}>
        <span className={styles.areaTotal}>
          {isUf ? formatUF(Math.round(totalUF)) : total.toLocaleString('es-CL')}
        </span>
        <span className={styles.areaSub}>
          {isUf
            ? `Promedio ${formatUF(Math.round(avgMonthlyUF))} / mes en ventana`
            : `${total.toLocaleString('es-CL')} reservas · prom ${avgReservasMonth.toFixed(1)} / mes`}
        </span>
      </div>
      <div className={styles.chartArea} aria-label={isUf ? 'Gráfico UF por mes' : 'Gráfico reservas por mes'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyBars} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="resumenAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef1f6" />
            <XAxis
              dataKey="label"
              tick={({ x, y, payload }) => {
                const isHi = monthlyBars.find((d) => d.label === payload.value)?.highlight
                return (
                  <g transform={`translate(${x},${y})`}>
                    {isHi && <rect x={-20} y={0} width={40} height={20} rx={10} fill={CHART_BLUE} />}
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
              height={32}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={<ChartTooltip isUf={isUf} />} />
            {isUf ? (
              <ReferenceLine
                y={avgMonthlyUF}
                stroke="#c5d0e3"
                strokeDasharray="4 4"
                label={{
                  value: `Prom ${formatUF(Math.round(avgMonthlyUF))}`,
                  position: 'insideTopRight',
                  fill: '#8b92a5',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey={dataKey}
              name={isUf ? 'UF' : 'Reservas'}
              stroke={CHART_BLUE}
              strokeWidth={2.5}
              fill="url(#resumenAreaGrad)"
              dot={{ r: 4, fill: CHART_BLUE, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
