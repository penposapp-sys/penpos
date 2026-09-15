import assert from 'node:assert/strict'
import { mergeAnaokuluResponses } from '../../frontend/src/anaokulu/utils/schoolScope.js'

const results = [
  { tenant: { id: 'school-a', name: 'A' }, data: { students: [{ id: 1, name: 'A student 1' }, { id: 2, name: 'A student 2' }, { id: 3, name: 'A student 3' }], collections: [{ id: 11, amount: 10 }], invoices: [{ uuid: 'a-invoice' }], checks: [] } },
  { tenant: { id: 'school-b', name: 'B' }, data: { students: Array.from({ length: 35 }, (_, index) => ({ id: index + 1, name: `B student ${index + 1}` })), collections: [{ id: 21, amount: 20 }], invoices: [{ uuid: 'b-invoice' }], checks: [] } },
  { tenant: { id: 'school-c', name: 'C' }, data: { students: [], collections: [], invoices: [], checks: [] } }
]

const merged = mergeAnaokuluResponses(results)
assert.equal(merged.students.filter((student) => student._schoolId === 'school-a').length, 3)
assert.equal(merged.students.filter((student) => student._schoolId === 'school-b').length, 35)
assert.equal(merged.students.filter((student) => student._schoolId === 'school-c').length, 0)
assert.equal(merged.students.length, 38)
assert.deepEqual(new Set(merged.students.map((student) => student._schoolId)), new Set(['school-a', 'school-b']))
assert.equal(merged.collections.find((collection) => collection._schoolId === 'school-a').amount, 10)
assert.equal(merged.collections.find((collection) => collection._schoolId === 'school-b').amount, 20)

console.log('Anaokulu A/B/C school-scope fixture passed: A=3, B=35, C=0, total=38')
