import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalAsesorEmail,
  isCorporateAsesorEmail,
} from './asesorEmail.js'

describe('asesorEmail', () => {
  it('canonicaliza .me a .cl', () => {
    assert.equal(
      canonicalAsesorEmail('Klettich@capitalinteligente.me'),
      'klettich@capitalinteligente.cl'
    )
  })

  it('deja .cl sin cambios', () => {
    assert.equal(
      canonicalAsesorEmail('klettich@capitalinteligente.cl'),
      'klettich@capitalinteligente.cl'
    )
  })

  it('acepta ambos dominios corporativos', () => {
    assert.equal(isCorporateAsesorEmail('a@capitalinteligente.cl'), true)
    assert.equal(isCorporateAsesorEmail('a@capitalinteligente.me'), true)
    assert.equal(isCorporateAsesorEmail('a@gmail.com'), false)
  })
})
