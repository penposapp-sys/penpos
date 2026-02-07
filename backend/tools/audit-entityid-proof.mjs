import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import User from '../src/models/User.js'
import AuditLog from '../src/models/AuditLog.js'
import { log } from '../src/services/auditService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-audit-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E Audit Tenant', slug: 'e2e-audit-tenant', status: 'active', isActive: true, systemType: 'kermes' }))
  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))
  const user = await User.findOne({ tenantId: tenant._id, email: 'e2e-audit@local' })
    .then(async (u) => u || User.create({ tenantId: tenant._id, branchId: branch._id, branchIds: [branch._id], systemType: 'kermes', name: 'E2E User', email: 'e2e-audit@local', passwordHash: 'x', role: 'tenant_admin', isActive: true, permissions: ['pos_access'] }))

  await AuditLog.deleteMany({ tenantId: tenant._id, action: { $in: ['e2e_empty_entity', 'e2e_invalid_entity', 'e2e_valid_entity'] } }).catch(() => {})

  await log(String(tenant._id), String(user._id), 'e2e_empty_entity', 'order', '', { ok: true })
  await log(String(tenant._id), String(user._id), 'e2e_invalid_entity', 'order', 'not-an-objectid', { ok: true })
  await log(String(tenant._id), String(user._id), 'e2e_valid_entity', 'order', String(tenant._id), { ok: true })

  const items = await AuditLog.find({ tenantId: tenant._id, action: { $in: ['e2e_empty_entity', 'e2e_invalid_entity', 'e2e_valid_entity'] } }).lean()
  const byAction = new Map(items.map(x => [x.action, x]))
  must(byAction.get('e2e_empty_entity'), 'empty entity audit must be created')
  must(byAction.get('e2e_invalid_entity'), 'invalid entity audit must be created')
  must(byAction.get('e2e_valid_entity'), 'valid entity audit must be created')
  must(byAction.get('e2e_empty_entity').entityId == null, 'empty entityId must become null/undefined')
  must(byAction.get('e2e_invalid_entity').entityId == null, 'invalid entityId must become null/undefined')
  must(String(byAction.get('e2e_valid_entity').entityId) === String(tenant._id), 'valid entityId must be saved')

  console.log(JSON.stringify({ pass: true }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (e) => {
  try {
    console.error('FAILED', e?.message || e)
  } finally {
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }
})

