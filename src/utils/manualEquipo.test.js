import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { manualEfectivoEquipo, puntosManualEquipo, SCORING } from './competenciaCapitalOpenScore.js'
import { EQUIPOS_CAPITAL_ONE } from '../data/competenciaCapitalOneTeams.js'

const equipo = EQUIPOS_CAPITAL_ONE[0]
const sinReservas = []

describe('manualEfectivoEquipo — promesas y escrituras del equipo', () => {
  it('sin carga de equipo, solo cuenta lo de los asesores', () => {
    const m = manualEfectivoEquipo(sinReservas, equipo, null, {})
    assert.equal(m.promesasCount, 0)
    assert.equal(m.escriturasCount, 0)
    assert.equal(m.promesasExtraEquipo, 0)
  })

  it('suma lo cargado al equipo', () => {
    const teamManual = { promesasCount: 3, escriturasCount: 2 }
    const m = manualEfectivoEquipo(sinReservas, equipo, teamManual, {})
    assert.equal(m.promesasCount, 3)
    assert.equal(m.escriturasCount, 2)
  })

  it('expone el desglose de cada origen', () => {
    const teamManual = { promesasCount: 4, escriturasCount: 1 }
    const m = manualEfectivoEquipo(sinReservas, equipo, teamManual, {})
    assert.equal(m.promesasDesdeAsesores, 0)
    assert.equal(m.promesasExtraEquipo, 4)
    assert.equal(m.escriturasExtraEquipo, 1)
    // El total es la suma de ambos origenes
    assert.equal(m.promesasCount, m.promesasDesdeAsesores + m.promesasExtraEquipo)
    assert.equal(m.escriturasCount, m.escriturasDesdeAsesores + m.escriturasExtraEquipo)
  })

  it('ignora valores negativos o invalidos', () => {
    const m = manualEfectivoEquipo(sinReservas, equipo, { promesasCount: -5, escriturasCount: 'x' }, {})
    assert.equal(m.promesasCount, 0)
    assert.equal(m.escriturasCount, 0)
  })

  it('las actividades siguen siendo solo del equipo', () => {
    const teamManual = { actividadOnlineCount: 2, actividadPresencialCount: 1 }
    const m = manualEfectivoEquipo(sinReservas, equipo, teamManual, {})
    assert.equal(m.actividadOnlineCount, 2)
    assert.equal(m.actividadPresencialCount, 1)
  })
})

describe('puntosManualEquipo sobre el efectivo', () => {
  it('convierte a puntos lo cargado al equipo', () => {
    const m = manualEfectivoEquipo(sinReservas, equipo, { promesasCount: 3, escriturasCount: 2 }, {})
    const pts = puntosManualEquipo(m)
    assert.equal(pts.promesas, 3 * SCORING.promesaPorRegistro)
    assert.equal(pts.escrituras, 2 * SCORING.escrituraPorRegistro)
  })

  it('promesas y escrituras del equipo no tocan las actividades', () => {
    const m = manualEfectivoEquipo(sinReservas, equipo, { promesasCount: 5 }, {})
    assert.equal(puntosManualEquipo(m).actividades, 0)
  })
})
