import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAccountCartQuantity } from './accountCart.js'

test('weight-based account cart entries convert grams to kilograms for pricing', () => {
  const quantity = normalizeAccountCartQuantity({ isWeightBased: true, qty: 1, weightGrams: 350 })

  assert.deepEqual(quantity, { qty: 0.35, weightGrams: 350 })
  assert.equal(4500 * quantity.qty, 1575)
})

test('weight-based account cart entries reject missing or invalid grams', () => {
  assert.equal(normalizeAccountCartQuantity({ isWeightBased: true, qty: 1 }), null)
  assert.equal(normalizeAccountCartQuantity({ isWeightBased: true, weightGrams: 0 }), null)
  assert.equal(normalizeAccountCartQuantity({ isWeightBased: true, weightGrams: 'abc' }), null)
})

test('regular account cart quantities remain unchanged', () => {
  assert.deepEqual(
    normalizeAccountCartQuantity({ isWeightBased: false, qty: 2 }),
    { qty: 2, weightGrams: null }
  )
})
