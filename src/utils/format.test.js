import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatDate } from './format.js'

/** Extrae el dia del texto formateado ("15 may 2026" -> "15"). */
function dia(texto) {
  return String(texto).trim().split(/\s+/)[0]
}

describe('formatDate', () => {
  it('no corre el dia en una fecha sin hora', () => {
    // new Date('2026-05-15') es medianoche UTC; en Chile (UTC-4) eso caia el 14.
    assert.equal(dia(formatDate('2026-05-15')), '15')
    assert.equal(dia(formatDate('2026-07-15')), '15')
  })

  it('respeta los extremos de la ventana Cyber', () => {
    assert.match(formatDate('2026-05-15'), /15/)
    assert.match(formatDate('2026-07-15'), /15/)
  })

  it('formatea un dia de un solo digito', () => {
    assert.equal(dia(formatDate('2026-06-01')), '01')
  })

  it('acepta un timestamp completo', () => {
    assert.notEqual(formatDate('2026-05-15T21:51:08.788219+00:00'), '—')
  })

  it('vacio o invalido no rompe', () => {
    assert.equal(formatDate(null), '—')
    assert.equal(formatDate(''), '—')
    assert.equal(formatDate('NaT'), '—')
    assert.equal(formatDate('no es fecha'), 'no es fecha')
  })
})
