import { useState } from 'react'
import { useResumenMetrics } from './hooks/useResumenMetrics.js'
import ResumenContextBar from './components/ResumenContextBar.jsx'
import ResumenEmptyState from './components/ResumenEmptyState.jsx'
import TrendChartCard from './components/TrendChartCard.jsx'
import {
  KpiHeroCard,
  KpiPulseCards,
  RankingInmobiliariaCard,
  GoalHealthCard,
  WeekdayActivityCard,
  ProyectosCard,
  ComunasCard,
  TipologiasCard,
  EstadoStackCard,
} from './components/ResumenCards.jsx'
import styles from './ResumenPage.module.css'

/**
 * @param {object} props
 * @param {object[]} props.reservas — reservas en ventana Cyber
 * @param {number} props.totalEnApi — total sin filtro de fechas
 * @param {Date|null} props.lastUpdated
 * @param {(payload: { type: string, value: string }) => void} [props.onDrillDown]
 */
export default function ResumenPage({ reservas, totalEnApi, lastUpdated, onDrillDown }) {
  const [chartMonths, setChartMonths] = useState(6)
  const metrics = useResumenMetrics(reservas, chartMonths)

  if (!reservas.length) {
    return (
      <div className={styles.wrap}>
        <ResumenContextBar filtradas={0} totalApi={totalEnApi ?? 0} lastUpdated={lastUpdated} />
        <ResumenEmptyState />
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <ResumenContextBar filtradas={metrics.total} totalApi={totalEnApi ?? metrics.total} lastUpdated={lastUpdated} />

      <section className={styles.zonePulse} aria-label="Indicadores principales">
        <KpiHeroCard metrics={metrics} />
        <KpiPulseCards metrics={metrics} />
      </section>

      <section className={styles.zoneMain} aria-label="Tendencia y ranking">
        <TrendChartCard metrics={metrics} chartMonths={chartMonths} onChartMonthsChange={setChartMonths} />
        <RankingInmobiliariaCard items={metrics.inmob} onDrillDown={onDrillDown} />
      </section>

      <section className={styles.zoneComposition} aria-label="Composición de cartera">
        <EstadoStackCard
          estadoCounts={metrics.estadoCounts}
          total={metrics.total}
          onDrillDown={onDrillDown}
        />
        <TipologiasCard tipos={metrics.tipos} total={metrics.total} />
        <ComunasCard comunas={metrics.comunas} total={metrics.total} />
        <ProyectosCard proyectos={metrics.proyectos} onDrillDown={onDrillDown} />
      </section>

      <section className={styles.zoneHealth} aria-label="Salud y actividad">
        <GoalHealthCard metrics={metrics} />
        <WeekdayActivityCard weekdayCounts={metrics.weekdayCounts} />
      </section>
    </div>
  )
}
