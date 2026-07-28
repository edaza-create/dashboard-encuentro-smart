import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dedupeReservasPorEvento } from './dedupeReservas.js'
import { esReservaVigente } from './reservaVigente.js'

describe('dedupeReservasPorEvento', () => {
  it('colapsa las filas created y fallen de una misma reserva', () => {
    const filas = [
      { id: 'ev1', brekto_id: 'R1', revertida: true, created_at: '2026-05-26T12:00:00Z' },
      { id: 'ev2', brekto_id: 'R1', revertida: false, created_at: '2026-05-26T10:00:00Z' },
    ]
    const out = dedupeReservasPorEvento(filas)
    assert.equal(out.length, 1)
    assert.equal(out[0].revertida, true, 'la caida es terminal')
  })

  it('la caida gana sin importar el orden de llegada', () => {
    const viva = { id: 'a', brekto_id: 'R1', revertida: false, created_at: '2026-05-26T10:00:00Z' }
    const caida = { id: 'b', brekto_id: 'R1', revertida: true, created_at: '2026-05-26T12:00:00Z' }
    assert.equal(dedupeReservasPorEvento([viva, caida])[0].revertida, true)
    assert.equal(dedupeReservasPorEvento([caida, viva])[0].revertida, true)
  })

  it('la caida gana aunque el evento vivo sea posterior', () => {
    const filas = [
      { id: 'a', brekto_id: 'R1', revertida: true, created_at: '2026-05-01T00:00:00Z' },
      { id: 'b', brekto_id: 'R1', revertida: false, created_at: '2026-06-01T00:00:00Z' },
    ]
    assert.equal(dedupeReservasPorEvento(filas)[0].revertida, true)
  })

  it('entre eventos vivos gana el mas reciente', () => {
    const filas = [
      { id: 'viejo', brekto_id: 'R1', revertida: false, created_at: '2026-05-01T00:00:00Z' },
      { id: 'nuevo', brekto_id: 'R1', revertida: false, created_at: '2026-06-01T00:00:00Z' },
    ]
    assert.equal(dedupeReservasPorEvento(filas)[0].id, 'nuevo')
  })

  it('no mezcla reservas distintas', () => {
    const filas = [
      { id: 'a', brekto_id: 'R1', revertida: false },
      { id: 'b', brekto_id: 'R2', revertida: false },
      { id: 'c', brekto_id: 'R3', revertida: true },
    ]
    assert.equal(dedupeReservasPorEvento(filas).length, 3)
  })

  it('deja pasar las filas sin brekto_id sin agruparlas', () => {
    // Un asesor puede tener varias reservas legitimas el mismo dia, mismo monto
    // y mismo proyecto: agrupar por esos campos borraria reservas validas.
    const filas = [
      { id: 'a', brekto_id: null, revertida: false, monto_uf: 3389.41 },
      { id: 'b', brekto_id: null, revertida: false, monto_uf: 3389.41 },
      { id: 'c', brekto_id: '', revertida: false, monto_uf: 3389.41 },
    ]
    assert.equal(dedupeReservasPorEvento(filas).length, 3)
  })

  it('lista vacia o nula devuelve vacio', () => {
    assert.deepEqual(dedupeReservasPorEvento([]), [])
    assert.deepEqual(dedupeReservasPorEvento(null), [])
  })
})

describe('caso real: Marco Espinoza', () => {
  // 4 reservas, cada una con evento created y fallen. Atlas devuelve 8 filas.
  // Antes del dedupe contaban 4 reservas y 60 pts; deben contar 0.
  const filas = ['R1', 'R2', 'R3', 'R4'].flatMap((bid) => [
    {
      id: `${bid}-fallen`,
      brekto_id: bid,
      estado: 'Cancelado',
      revertida: true,
      created_at: '2026-05-26T14:00:00Z',
    },
    {
      id: `${bid}-created`,
      brekto_id: bid,
      estado: 'Pendiente',
      revertida: false,
      created_at: '2026-05-26T09:00:00Z',
    },
  ])

  it('Atlas entrega 8 filas para 4 reservas', () => {
    assert.equal(filas.length, 8)
    assert.equal(new Set(filas.map((f) => f.brekto_id)).size, 4)
  })

  it('sin dedupe, 4 reservas caidas seguirian puntuando', () => {
    const cuentan = filas.filter(esReservaVigente)
    assert.equal(cuentan.length, 4, 'esta es la fuga que se corrige')
    assert.equal(cuentan.length * 15, 60, '60 puntos fantasma')
  })

  it('con dedupe, ninguna puntua', () => {
    const reservas = dedupeReservasPorEvento(filas)
    assert.equal(reservas.length, 4, 'quedan las 4 reservas reales')
    assert.equal(reservas.filter(esReservaVigente).length, 0)
  })
})
