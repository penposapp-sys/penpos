import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdjacentCategoryId, getCategorySwipeDirection } from './useCategorySwipe.js'

const categories = [{ id: 'drinks' }, { id: 'food' }]

test('category swipe advances to the next category and stops at the final category', () => {
  assert.equal(getAdjacentCategoryId(categories, 'drinks', 1), 'food')
  assert.equal(getAdjacentCategoryId(categories, 'food', 1), null)
})

test('category swipe moves backward and stops before the first category', () => {
  assert.equal(getAdjacentCategoryId(categories, 'food', -1), 'drinks')
  assert.equal(getAdjacentCategoryId(categories, 'drinks', -1), null)
})

test('all-category mode includes the all-products category', () => {
  assert.equal(getAdjacentCategoryId(categories, '', 1, true), 'drinks')
  assert.equal(getAdjacentCategoryId(categories, 'drinks', -1, true), '')
})

test('only a dominant horizontal drag switches category', () => {
  assert.equal(getCategorySwipeDirection({ x: 150, y: 100 }, { x: 90, y: 110 }), 1)
  assert.equal(getCategorySwipeDirection({ x: 150, y: 100 }, { x: 210, y: 105 }), -1)
  assert.equal(getCategorySwipeDirection({ x: 150, y: 100 }, { x: 140, y: 160 }), 0)
  assert.equal(getCategorySwipeDirection({ x: 150, y: 100 }, { x: 110, y: 102 }), 0)
})
