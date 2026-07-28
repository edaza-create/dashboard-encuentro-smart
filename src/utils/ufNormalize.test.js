import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ufMontoPlanillaReserva, ufNormalizadoPlanilla } from './ufNormalize.js'

describe('ufNormalizadoPlanilla', () => {
  it('repara valores malformados de la planilla', () => {
    // Para eso existe: la planilla xlsx trae UF con digitos de mas.
    assert.equal(ufNormalizadoPlanilla(18_676_006), 1867.6)
    // Solo hay un digito decimal disponible, se rellena con 0.
    assert.equal(ufNormalizadoPlanilla(31066), 3106.6)
  })

  it('deja pasar un valor de 4 digitos', () => {
    assert.equal(ufNormalizadoPlanilla(3389), 3389)
  })

  it('vacio o invalido es 0', () => {
    assert.equal(ufNormalizadoPlanilla(null), 0)
    assert.equal(ufNormalizadoPlanilla(''), 0)
    assert.equal(ufNormalizadoPlanilla('abc'), 0)
  })
})

describe('ufMontoPlanillaReserva', () => {
  it('prefiere valor_promesa_uf sobre valor_venta_uf', () => {
    const r = { valor_promesa_uf: 3000, valor_venta_uf: 2000, uf_ya_normalizada: true }
    assert.equal(ufMontoPlanillaReserva(r), 3000)
  })

  it('cae a valor_venta_uf si la promesa es 0', () => {
    const r = { valor_promesa_uf: 0, valor_venta_uf: 2500, uf_ya_normalizada: true }
    assert.equal(ufMontoPlanillaReserva(r), 2500)
  })

  it('con uf_ya_normalizada conserva los decimales', () => {
    // Las UF de API vienen limpias; el normalizador de planilla los truncaria.
    const r = { valor_promesa_uf: 3389.41, uf_ya_normalizada: true }
    assert.equal(ufMontoPlanillaReserva(r), 3389.41)
  })

  it('sin la marca, una reserva de planilla pasa por el normalizador', () => {
    const r = { valor_promesa_uf: 31066 }
    assert.equal(ufMontoPlanillaReserva(r), 3106.6)
  })

  it('la marca protege a las propiedades de 10.000 UF o mas', () => {
    // Sin la marca, ufNormalizadoPlanilla toma los primeros 4 digitos y una
    // propiedad de 12.500 UF quedaria en 1250: pierde el 90% de su valor.
    const deApi = { valor_promesa_uf: 12500, uf_ya_normalizada: true }
    assert.equal(ufMontoPlanillaReserva(deApi), 12500)

    const sinMarca = { valor_promesa_uf: 12500 }
    assert.equal(ufMontoPlanillaReserva(sinMarca), 1250, 'asi se veria el bug')
  })

  it('reserva nula o sin montos es 0', () => {
    assert.equal(ufMontoPlanillaReserva(null), 0)
    assert.equal(ufMontoPlanillaReserva({}), 0)
  })
})
