import assert from 'node:assert/strict'
import { requirePermission } from '../src/middlewares/requirePermission.js'

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code
    return this
  },
  json(payload) {
    this.payload = payload
    return this
  }
})

const runAsSuperadmin = (middleware, reqOverrides = {}) => {
  const req = {
    user: { role: 'superadmin', permissions: [], tenantId: 'tenant-1' },
    path: '/api/tenant/staff',
    originalUrl: '/api/tenant/staff',
    method: 'POST',
    ...reqOverrides,
  }
  const res = makeResponse()
  let nextCalled = false
  const next = (err) => {
    nextCalled = true
    if (err) throw err
  }

  middleware(req, res, next)
  return { nextCalled, res }
}

assert.throws(() => {
  const { nextCalled } = runAsSuperadmin(requirePermission(['manage_settings']))
  assert.equal(nextCalled, false)
}, /forbidden|Bu işlem için yetkiniz yok/)

const allowed = runAsSuperadmin(requirePermission(['manage_settings'], { allowSuperadmin: true }))
assert.equal(allowed.nextCalled, true)

console.log('superadmin permission matrix checks passed')
