import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reservationBranchScope } from '../src/middlewares/reservationBranchScope.js'

const activeBranchId = '64b000000000000000000002'
const otherBranchId = '64b000000000000000000008'

const runScope = (req) => {
  let result
  reservationBranchScope(req, {}, (err) => { result = err || null })
  return result
}

test('staff reservation scope is restricted to the active authorized branch', () => {
  const req = {
    user: { role: 'staff', branchId: activeBranchId, branchIds: [activeBranchId, otherBranchId] },
    branchIds: [activeBranchId, otherBranchId],
    query: { branchId: activeBranchId },
    headers: { 'x-branch-id': activeBranchId }
  }

  assert.equal(runScope(req), null)
  assert.deepEqual(req.branchIds, [activeBranchId])
})

test('staff cannot request a different allowed branch by changing query or header', () => {
  const req = {
    user: { role: 'staff', branchId: activeBranchId, branchIds: [activeBranchId, otherBranchId] },
    branchIds: [activeBranchId, otherBranchId],
    query: { branchId: otherBranchId },
    headers: { 'x-branch-id': activeBranchId }
  }

  assert.equal(runScope(req)?.status, 403)
})

test('staff cannot change the active branch through the request header', () => {
  const req = {
    user: { role: 'staff', branchId: activeBranchId, branchIds: [activeBranchId, otherBranchId] },
    branchIds: [activeBranchId, otherBranchId],
    query: { branchId: activeBranchId },
    headers: { 'x-branch-id': otherBranchId }
  }

  assert.equal(runScope(req)?.status, 403)
})

test('staff without a determinable active branch are denied instead of assigned a fallback', () => {
  const req = {
    user: { role: 'staff', branchId: null, branchIds: [activeBranchId, otherBranchId] },
    branchIds: [activeBranchId, otherBranchId],
    query: {},
    headers: { 'x-branch-id': activeBranchId }
  }

  assert.equal(runScope(req)?.status, 403)
})

test('reservation branch scope does not narrow an authorized manager all-branches scope', () => {
  const req = {
    user: { role: 'tenant_admin' },
    branchIds: [activeBranchId, otherBranchId],
    query: { branchIds: `${activeBranchId},${otherBranchId}` },
    headers: {}
  }

  assert.equal(runScope(req), null)
  assert.deepEqual(req.branchIds, [activeBranchId, otherBranchId])
})
