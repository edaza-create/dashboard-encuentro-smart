import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAsistenciaPuntos,
  breakdownReunion,
  equiposLiderAsistentes,
  PTS_ASISTENCIA_REUNION,
} from './buildAsistenciaPuntos.js'

test('equiposLiderAsistentes elige mayor conteo absoluto', () => {
  const map = new Map([
    ['1', { online: 10, presencial: 6 }],
    ['3', { online: 12, presencial: 7 }],
    ['4', { online: 2, presencial: 2 }],
  ])
  assert.deepEqual([...equiposLiderAsistentes(map)], ['3'])
})

test('buildAsistenciaPuntos otorga +15 solo al lider por reunion', () => {
  const roster = new Map([
    ['1', new Set(['a@x.cl'])],
    ['3', new Set(['b@x.cl'])],
  ])
  const conteos = [
    { reunion_id: 'r1', equipo_id: 3, modalidad: 'Online', total: 12 },
    { reunion_id: 'r1', equipo_id: 3, modalidad: 'Presencial', total: 7 },
    { reunion_id: 'r1', equipo_id: 1, modalidad: 'Online', total: 10 },
    { reunion_id: 'r1', equipo_id: 1, modalidad: 'Presencial', total: 6 },
  ]
  const pts = buildAsistenciaPuntos(conteos, roster)
  assert.equal(pts['3'].total, PTS_ASISTENCIA_REUNION)
  assert.equal(pts['1'], undefined)
})

test('breakdownReunion mantiene formato asistentes/roster', () => {
  const roster = new Map([
    ['3', new Set(Array.from({ length: 66 }, (_, i) => `u${i}@y.cl`))],
  ])
  const rows = breakdownReunion(
    [
      { equipo_id: 3, modalidad: 'Online', total: 12 },
      { equipo_id: 3, modalidad: 'Presencial', total: 7 },
    ],
    roster
  )
  assert.equal(rows[0].online + rows[0].presencial, 19)
  assert.equal(rows[0].rosterSize, 66)
  assert.equal(rows[0].ptsTotal, PTS_ASISTENCIA_REUNION)
})
