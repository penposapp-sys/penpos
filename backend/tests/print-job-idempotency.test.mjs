import assert from 'node:assert/strict'
import { test } from 'node:test'
import PrintJob from '../src/models/PrintJob.js'

test('print jobs support tenant-scoped unique idempotency keys', () => {
  const index = PrintJob.schema.indexes().find(([, options]) =>
    options.unique === true &&
    options.partialFilterExpression?.['meta.idempotencyKey']?.$type === 'string'
  )

  assert.ok(index)
  assert.deepEqual(index[0], {
    tenantId: 1,
    system: 1,
    type: 1,
    'meta.idempotencyKey': 1
  })
})
