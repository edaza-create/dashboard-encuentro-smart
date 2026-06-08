import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechaEfectivaReunion, reunionCuentaParaPuntos } from './asistenciaFechaCorte.js'

test('fechaEfectivaReunion prioriza fecha_evento', () => {
  assert.equal(
    fechaEfectivaReunion({
      fecha_evento: '2026-05-22',
      qr_generated_at: '2026-05-10T12:00:00Z',
    }),
    '2026-05-22'
  )
})

test('reunionCuentaParaPuntos incluye hoy y excluye ayer', () => {
  const corte = '2026-05-22'
  assert.equal(
    reunionCuentaParaPuntos({ fecha_evento: '2026-05-22' }, corte),
    true
  )
  assert.equal(
    reunionCuentaParaPuntos({ fecha_evento: '2026-05-21' }, corte),
    false
  )
})

test('reunionCuentaParaPuntos usa qr_generated_at si no hay fecha_evento', () => {
  assert.equal(
    reunionCuentaParaPuntos(
      { qr_generated_at: '2026-05-22T15:00:00Z' },
      '2026-05-22'
    ),
    true
  )
  assert.equal(
    reunionCuentaParaPuntos(
      { qr_generated_at: '2026-05-21T15:00:00Z' },
      '2026-05-22'
    ),
    false
  )
})
