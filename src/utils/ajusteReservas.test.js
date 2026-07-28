import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  reservasEfectivas,
  tieneAjusteReservas,
  totalIndividual,
} from './competenciaCapitalOpenIndividual.js'
import { SCORING } from './competenciaCapitalOpenScore.js'

describe('reservasEfectivas', () => {
  it('sin ajuste usa el conteo automatico', () => {
    assert.equal(reservasEfectivas({ reservasOverride: null }, 12), 12)
    assert.equal(reservasEfectivas({}, 12), 12)
    assert.equal(reservasEfectivas(null, 12), 12)
  })

  it('con ajuste, el ajuste manda', () => {
    assert.equal(reservasEfectivas({ reservasOverride: 15 }, 12), 15)
    assert.equal(reservasEfectivas({ reservasOverride: 8 }, 12), 8)
  })

  it('un ajuste a 0 es valido y no cae al automatico', () => {
    // Caso real: reservas caidas que la fuente todavia da por vigentes.
    assert.equal(reservasEfectivas({ reservasOverride: 0 }, 4), 0)
  })

  it('un ajuste invalido cae al automatico', () => {
    assert.equal(reservasEfectivas({ reservasOverride: -3 }, 12), 12)
    assert.equal(reservasEfectivas({ reservasOverride: NaN }, 12), 12)
  })

  it('trunca decimales', () => {
    assert.equal(reservasEfectivas({ reservasOverride: 7.9 }, 12), 7)
  })
})

describe('tieneAjusteReservas', () => {
  it('distingue ajuste presente de ausente', () => {
    assert.equal(tieneAjusteReservas({ reservasOverride: 5 }), true)
    assert.equal(tieneAjusteReservas({ reservasOverride: 0 }), true, '0 es un ajuste')
    assert.equal(tieneAjusteReservas({ reservasOverride: null }), false)
    assert.equal(tieneAjusteReservas({}), false)
    assert.equal(tieneAjusteReservas(null), false)
  })
})

describe('totalIndividual con ajuste', () => {
  it('puntua sobre el conteo ajustado, no el automatico', () => {
    const entry = { promesasCount: 0, escriturasCount: 0, reservasOverride: 15 }
    assert.equal(totalIndividual(entry, 12), 15 * SCORING.reservaPorRegistro)
  })

  it('un ajuste a 0 deja al asesor sin puntos de reserva', () => {
    const entry = { promesasCount: 0, escriturasCount: 0, reservasOverride: 0 }
    assert.equal(totalIndividual(entry, 4), 0)
  })

  it('el ajuste no toca promesas ni escrituras', () => {
    const entry = { promesasCount: 2, escriturasCount: 1, reservasOverride: 10 }
    const esperado =
      10 * SCORING.reservaPorRegistro +
      2 * SCORING.promesaPorRegistro +
      1 * SCORING.escrituraPorRegistro
    assert.equal(totalIndividual(entry, 3), esperado)
  })

  it('sin ajuste se comporta como antes', () => {
    const entry = { promesasCount: 1, escriturasCount: 0, reservasOverride: null }
    const esperado = 12 * SCORING.reservaPorRegistro + SCORING.promesaPorRegistro
    assert.equal(totalIndividual(entry, 12), esperado)
  })
})
