import assert from 'node:assert/strict'
import { test } from 'node:test'
import Table from '../src/models/Table.js'
import WaiterCall from '../src/models/WaiterCall.js'
import { reservationBranchScope } from '../src/middlewares/reservationBranchScope.js'
import { listWaiterCalls } from '../src/services/waiterCallService.js'
import { requirePermission } from '../src/middlewares/requirePermission.js'

const tenantId = '64b000000000000000000001'
const branchA = '64b000000000000000000002'
const branchB = '64b000000000000000000003'
const staffId = '64b000000000000000000007'
const tableA = '64b000000000000000000010'

test('reservation scope allows staff only within their active authorized branch', async () => {
  const makeRequest = (id, activeBranchId = branchA, scopedBranchIds = [branchA]) => ({
    user: { id, role: 'staff', tenantId, branchId: activeBranchId, accessibleBranchIds: [branchA, branchB] },
    branchIds: scopedBranchIds,
    query: {},
    headers: {}
  })
  let allowedError
  await reservationBranchScope(makeRequest(staffId), {}, (err) => { allowedError = err })
  assert.equal(allowedError, undefined)

  let deniedError
  await reservationBranchScope(makeRequest(staffId, branchB), {}, (err) => { deniedError = err })
  assert.equal(deniedError?.status, 403)
})

test('reservation scope does not require a separate branch-level staff assignment', async () => {
  const req = {
    user: { id: staffId, role: 'staff', tenantId, branchId: branchA, accessibleBranchIds: [branchA] },
    branchIds: [branchA], query: {}, headers: {}
  }
  let scopeError
  await reservationBranchScope(req, {}, (err) => { scopeError = err })
  assert.equal(scopeError, undefined)
  assert.deepEqual(req.branchIds, [branchA])
})

test('staff waiter-call query includes only the assigned branch and its tables', async (t) => {
  let capturedFilter
  t.mock.method(Table, 'find', (filter) => {
    assert.deepEqual(filter, { tenantId, branchId: { $in: [branchA] } })
    return { distinct: async () => [tableA] }
  })
  t.mock.method(WaiterCall, 'find', (filter) => {
    capturedFilter = filter
    return { sort() { return this }, lean: async () => [] }
  })

  await listWaiterCalls(tenantId, { branchIds: [branchA] })
  assert.deepEqual(capturedFilter, {
    tenantId,
    status: 'open',
    $or: [
      { branchId: { $in: [branchA] } },
      { tableId: { $in: [tableA] } }
    ]
  })
  assert.equal(capturedFilter.$or.some((part) => JSON.stringify(part).includes(branchB)), false)
})

test('reservation permissions are independently enforced for staff', () => {
  const authorize = (permissions, required) => {
    let nextError
    requirePermission(required)({ user: { id: staffId, role: 'staff', tenantId, permissions } }, {}, (err) => { nextError = err })
    return nextError
  }

  assert.equal(authorize(['reservations_view'], 'reservations_view'), undefined)
  assert.equal(authorize(['reservations_view'], 'reservations_create')?.status, 403)
  assert.equal(authorize(['reservations_create'], 'reservations_create'), undefined)
  assert.equal(authorize(['reservations_approve'], 'reservations_approve'), undefined)
})
