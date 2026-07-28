import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { esReservaVigente, estadoEsCaida, soloReservasVigentes } from './reservaVigente.js'

describe('estadoEsCaida', () => {
  it('marca los estados documentados por ORED', () => {
    assert.equal(estadoEsCaida('Cancelado'), true)
    assert.equal(estadoEsCaida('Rechazado'), true)
  })

  it('marca revertida y anulada, en ambos generos', () => {
    for (const e of ['Revertida', 'Revertido', 'Anulada', 'Anulado']) {
      assert.equal(estadoEsCaida(e), true, `${e} deberia contar como caida`)
    }
  })

  it('no marca los estados que si puntuan', () => {
    for (const e of ['Pendiente', 'Terminado', 'Procesando', 'Toma Unidad', 'Registrada']) {
      assert.equal(estadoEsCaida(e), false, `${e} deberia puntuar`)
    }
  })

  it('Pendiente es la reserva viva, no un tramite a medias', () => {
    // La trampa mas comun: en Brekto se muestra como "Reservado".
    assert.equal(estadoEsCaida('Pendiente'), false)
  })

  it('ignora mayusculas y espacios', () => {
    assert.equal(estadoEsCaida('  CANCELADO '), true)
    assert.equal(estadoEsCaida('cancelado'), true)
  })

  it('sin estado no asume caida', () => {
    assert.equal(estadoEsCaida(null), false)
    assert.equal(estadoEsCaida(undefined), false)
    assert.equal(estadoEsCaida(''), false)
  })
})

describe('esReservaVigente', () => {
  it('excluye por el booleano revertida', () => {
    assert.equal(esReservaVigente({ estado: 'Pendiente', revertida: true }), false)
  })

  it('excluye por archivado', () => {
    assert.equal(esReservaVigente({ estado: 'Pendiente', archivado: true }), false)
  })

  it('excluye por estado de caida aunque el booleano venga en false', () => {
    assert.equal(esReservaVigente({ estado: 'Cancelado', revertida: false }), false)
    assert.equal(esReservaVigente({ estado: 'Revertida', revertida: false }), false)
  })

  it('acepta una reserva viva', () => {
    assert.equal(esReservaVigente({ estado: 'Pendiente', revertida: false }), true)
    assert.equal(esReservaVigente({ estado: 'Terminado' }), true)
  })

  it('una reserva nula no es vigente', () => {
    assert.equal(esReservaVigente(null), false)
  })
})

describe('soloReservasVigentes', () => {
  it('filtra la mezcla de estados', () => {
    const reservas = [
      { id: 1, estado: 'Pendiente' },
      { id: 2, estado: 'Cancelado' },
      { id: 3, estado: 'Terminado' },
      { id: 4, estado: 'Revertida' },
      { id: 5, estado: 'Procesando' },
      { id: 6, estado: 'Pendiente', revertida: true },
    ]
    assert.deepEqual(
      soloReservasVigentes(reservas).map((r) => r.id),
      [1, 3, 5]
    )
  })

  it('lista vacia o nula devuelve vacio', () => {
    assert.deepEqual(soloReservasVigentes([]), [])
    assert.deepEqual(soloReservasVigentes(null), [])
  })
})
