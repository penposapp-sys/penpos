import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLabelAmountLine, labelServingTypeText } from './labelServingType.js'

test('label amount includes the saved plate, tray, or package selection', () => {
  assert.equal(buildLabelAmountLine({ qty: 1, servingType: 'plate' }), '1 ADET - TABAKTA')
  assert.equal(buildLabelAmountLine({ qty: 2, servingType: 'tray' }), '2 ADET - TEPSIDE')
  assert.equal(buildLabelAmountLine({ qty: 1, servingType: 'package' }), '1 ADET - PAKET')
})

test('label serving text accepts Turkish labels and keeps weight amounts', () => {
  assert.equal(labelServingTypeText('Tepside'), 'TEPSIDE')
  assert.equal(buildLabelAmountLine({ isWeightBased: true, weightGrams: 350, servingType: 'tabakta' }), '350 GR - TABAKTA')
})
