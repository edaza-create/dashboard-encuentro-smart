import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeResumenMetrics } from './useResumenMetrics.js'

const sample = [
  {
    fecha_reserva: '2026-05-10',
    estado: 'Aprobado',
    inmobiliaria: 'Alpha',
    comuna: 'Las Condes',
    tipologia: '2D2B',
    proyecto: 'Proyecto X',
    tipo_entrega: 'futura',
    monto_uf: 2500,
  },
  {
    fecha_reserva: '2026-05-12',
    estado: 'Cancelado',
    inmobiliaria: 'Beta',
    comuna: 'Providencia',
    tipologia: '3D2B',
    proyecto: 'Proyecto Y',
    tipo_entrega: 'inmediata',
    monto_uf: 3000,
  },
  {
    fecha_reserva: '2026-04-08',
    estado: 'Pendiente',
    inmobiliaria: 'Alpha',
    comuna: 'Las Condes',
    tipologia: '2D2B',
    proyecto: 'Proyecto X',
    tipo_entrega: 'inmediata',
    monto_uf: 2000,
  },
]

describe('computeResumenMetrics', () => {
  it('cuenta total y estados', () => {
    const m = computeResumenMetrics(sample, 6)
    assert.equal(m.total, 3)
    assert.equal(m.estadoCounts.apr, 1)
    assert.equal(m.estadoCounts.canc, 1)
    assert.equal(m.estadoCounts.pend, 1)
    assert.equal(m.futuraN, 1)
  })

  it('ordena inmobiliaria por volumen', () => {
    const m = computeResumenMetrics(sample, 6)
    assert.equal(m.inmob[0].name, 'Alpha')
    assert.equal(m.inmob[0].value, 2)
  })

  it('calcula salud de cartera', () => {
    const m = computeResumenMetrics(sample, 6)
    assert.equal(m.activas, 2)
    assert.equal(m.healthyPct, 67)
  })

  it('serie mensual incluye buckets', () => {
    const m = computeResumenMetrics(sample, 6)
    assert.ok(m.monthlyBars.length >= 1)
    const may = m.monthlyBars.find((b) => b.key === '2026-05')
    assert.ok(may)
    assert.equal(may.reservas, 2)
  })

  it('dataset vacío no rompe', () => {
    const m = computeResumenMetrics([], 6)
    assert.equal(m.total, 0)
    assert.equal(m.totalUF, 0)
    assert.equal(m.healthyPct, 0)
  })
})
