import assert from 'node:assert/strict'
import { calculateSchoolsDebtMatrix } from '../../frontend/src/anaokulu/utils/calculations.js'

const report = calculateSchoolsDebtMatrix([{ id: 'A', name: 'A', detail: {
  settings: { yearStart: '2026-01' },
  students: [{ id: 1, name: 'Student A', class: '4', items: [{ name: 'Plan', basePrice: 215000, total: 165000, installments: 10, downPayment: 5000, start: '2026-01-15' }] }],
  collections: [
    { studentId: 1, item: 'Plan', installmentNo: 0, amount: 5000 },
    { studentId: 1, item: 'Plan', installmentNo: 1, amount: 16500 }
  ]
} }], '2026', '2026-12-31')

const row = report.schools[0].students[0]
assert.equal(row.monthly['2026-01'].amount, 0)
assert.equal(row.monthly['2026-02'].amount, 16000)
assert.equal(row.annualTotal, 144000)
assert.equal(row.annualTotal, Object.values(row.monthly).reduce((sum, month) => sum + month.amount, 0))
assert.equal(report.totalStudents, 1)
console.log('Anaokulu monthly matrix fixture passed: Jan=0, Feb=16000, annual=144000')
