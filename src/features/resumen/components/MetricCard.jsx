import { TrendingUp, TrendingDown } from 'lucide-react'
import styles from '../ResumenPage.module.css'

export function DeltaBadge({ value, dir }) {
  if (value == null || value === '') return null
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

export default function MetricCard({
  title,
  subtitle,
  metric,
  metricClass,
  delta,
  deltaDir,
  featured = false,
  footer,
  children,
  icon: Icon,
  className = '',
}) {
  return (
    <div className={`${styles.card} ${featured ? styles.cardFeatured : ''} ${className}`.trim()}>
      <div className={styles.cardHead}>
        <div className={styles.cardHeadText}>
          <div className={styles.title}>
            {Icon ? <Icon size={14} className={styles.titleIcon} aria-hidden /> : null}
            {title}
          </div>
          {subtitle ? <div className={styles.sub}>{subtitle}</div> : null}
        </div>
      </div>
      {metric != null ? (
        <div className={styles.metricRow}>
          <span className={`${styles.metricValue} ${metricClass || ''}`}>{metric}</span>
          <DeltaBadge value={delta} dir={deltaDir} />
        </div>
      ) : null}
      {children}
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </div>
  )
}
