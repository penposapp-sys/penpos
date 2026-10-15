import assert from 'node:assert/strict'
import { test } from 'node:test'
import Branch from '../src/models/Branch.js'
import Reservation from '../src/models/Reservation.js'
import ReservationNotification from '../src/models/ReservationNotification.js'
import Tenant from '../src/models/Tenant.js'
import User from '../src/models/User.js'
import { createServer } from '../src/app.js'
import { signToken } from '../src/utils/jwt.js'

const tenantId = '64b000000000000000000001'
const branchId = '64b000000000000000000002'
const userId = '64b000000000000000000007'

const query = (value) => ({
  select() { return this },
  sort() { return this },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject) }
})

test('reservation route authenticates before checking subscription and preserves authorized branch scope', async (t) => {
  const tenant = {
    _id: tenantId,
    id: tenantId,
    name: 'Test Tenant',
    status: 'active',
    subscriptionStatus: 'active',
    allowedBranchIds: [branchId]
  }
  const branch = { _id: branchId, id: branchId, name: 'Merkez', isActive: true }
  const user = {
    _id: userId,
    name: 'Test Admin',
    role: 'tenant_admin',
    tenantId,
    permissions: [],
    isActive: true
  }

  t.mock.method(User, 'findById', () => query(user))
  t.mock.method(Tenant, 'findById', () => query(tenant))
  t.mock.method(Tenant, 'findOne', () => query(tenant))
  t.mock.method(Branch, 'find', () => query([branch]))
  t.mock.method(Reservation, 'countDocuments', async () => 0)
  t.mock.method(ReservationNotification, 'countDocuments', async () => 0)

  const app = createServer()
  const server = app.listen(0)
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve())
  }))
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reservations/pending-count?branchId=${branchId}`, {
    headers: { Authorization: `Bearer ${signToken({ sub: userId, tenantId })}` }
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.pendingCount, 0)
  assert.equal(body.unreadCount, 0)
})
