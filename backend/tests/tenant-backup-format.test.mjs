import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import '../src/app.js'
import {
  buildTenantDataFilter,
  classifyReferenceTargetOwnership,
  finalizeTenantBackup,
  buildBackupReferenceLookupPlan,
  clearMissingOptionalReferences,
  getMissingReferenceHandling,
  getTenantResetSnapshotHash,
  getReferencePaths,
  isTenantOwnedBackupDocument,
  resolveReferenceTargetCollection,
  parseAndVerifyTenantBackup
} from '../src/services/tenantBackupService.js'

const tenantId = '672c042aef61657e995126ac'
const tenantObjectId = new mongoose.Types.ObjectId(tenantId)

const makeArchive = () => {
  const userId = new mongoose.Types.ObjectId('672c042aef61657e995126ad')
  return finalizeTenantBackup({
    format: 'penpos-tenant-full-backup',
    version: 1,
    createdAt: '2026-10-12T00:00:00.000Z',
    tenant: {
      id: tenantId,
      name: 'Örnek Firma',
      system: 'restaurant',
      profile: {
        description: 'Örnek açıklama',
        phone: '5551234567',
        settings: { currency: 'TRY' },
        allowedBranchIds: [new mongoose.Types.ObjectId('672c042aef61657e995126ac')]
      }
    },
    collections: {
      users: [{ _id: userId, tenantId: tenantObjectId, role: 'tenant_admin' }],
      accountappearancepreferences: [{ _id: new mongoose.Types.ObjectId(), userId, darkMode: true }],
      branches: [{
        _id: new mongoose.Types.ObjectId('672c042aef61657e995126ac'),
        tenantId: tenantObjectId,
        name: 'Ana Şube'
      }]
    }
  })
}

test('restore reference validation batches duplicate external IDs by target collection', () => {
  const firstTenantId = new mongoose.Types.ObjectId('672c042aef61657e995126ae')
  const secondTenantId = new mongoose.Types.ObjectId('672c042aef61657e995126af')
  const archivedOrderId = new mongoose.Types.ObjectId('672c042aef61657e995126b0')
  const parsed = {
    backup: {
      collections: {
        orders: [
          { _id: new mongoose.Types.ObjectId(), tenantId: firstTenantId },
          { _id: new mongoose.Types.ObjectId(), tenantId: firstTenantId },
          { _id: new mongoose.Types.ObjectId(), tenantId: secondTenantId },
          { _id: new mongoose.Types.ObjectId(), tenantId: archivedOrderId }
        ],
        canteen_sales: [{ tenantId: secondTenantId }]
      }
    },
    idsByCollection: new Map([['tenants', new Set([String(archivedOrderId)])]])
  }
  const references = [
    { sourceCollection: 'orders', path: 'tenantId', targetCollection: 'tenants', required: true },
    { sourceCollection: 'canteen_sales', path: 'tenantId', targetCollection: 'tenants', required: true }
  ]

  const plan = buildBackupReferenceLookupPlan(parsed, 'restaurant', references)
  const lookups = [...plan.get('tenants').values()]

  assert.deepEqual([...plan.keys()], ['tenants'])
  assert.deepEqual(lookups.map(({ id }) => String(id)), [String(firstTenantId), String(secondTenantId)])
  assert.equal(lookups[0].references.length, 2)
  assert.equal(lookups[1].references.length, 1)
  assert.equal(lookups[0].references[0].required, true)
})

test('restore cleanup clears only specified stale optional reference values', () => {
  const staleStationId = new mongoose.Types.ObjectId('672c042aef61657e995126b1')
  const currentStationId = new mongoose.Types.ObjectId('672c042aef61657e995126b2')
  const printJob = {
    _id: new mongoose.Types.ObjectId('672c042aef61657e995126b3'),
    status: 'queued',
    stationId: staleStationId,
    lockedByStationId: currentStationId
  }
  const repairs = new Map([[
    'print_jobs',
    new Map([[String(printJob._id), [{
      path: 'stationId',
      key: mongoose.mongo.BSON.EJSON.stringify(staleStationId, null, 0, { relaxed: false })
    }]]])
  ]])

  const restored = clearMissingOptionalReferences(printJob, 'print_jobs', repairs)

  assert.equal(restored.stationId, null)
  assert.equal(String(restored.lockedByStationId), String(currentStationId))
})

test('missing print station references preserve history and only unassign queued jobs', () => {
  const stationId = new mongoose.Types.ObjectId('672c042aef61657e995126b4')
  const stationRef = { sourceCollection: 'print_jobs', path: 'stationId', required: false }
  const lockRef = { sourceCollection: 'print_jobs', path: 'lockedByStationId', required: false }
  const statuses = ['printed', 'canceled', 'failed']

  assert.equal(getMissingReferenceHandling(stationRef, { status: 'queued' }), 'unassign-queued')
  for (const status of statuses) {
    assert.equal(getMissingReferenceHandling(stationRef, { status }), 'preserve-history')
    assert.equal(getMissingReferenceHandling(lockRef, { status }), 'preserve-history')
  }
  assert.equal(getMissingReferenceHandling(lockRef, { status: 'queued' }), 'preserve-history')

  const historicalJob = {
    _id: new mongoose.Types.ObjectId('672c042aef61657e995126b5'),
    status: 'printed',
    stationId,
    lockedByStationId: stationId
  }
  const historicalRepairs = new Map([[
    'print_jobs',
    new Map([[String(historicalJob._id), [
      {
        path: 'stationId',
        key: mongoose.mongo.BSON.EJSON.stringify(stationId, null, 0, { relaxed: false })
      },
      {
        path: 'lockedByStationId',
        key: mongoose.mongo.BSON.EJSON.stringify(stationId, null, 0, { relaxed: false })
      }
    ]]])
  ]])
  clearMissingOptionalReferences(historicalJob, 'print_jobs', historicalRepairs)
  assert.equal(String(historicalJob.stationId), String(stationId))
  assert.equal(String(historicalJob.lockedByStationId), String(stationId))

  const queuedJob = {
    _id: new mongoose.Types.ObjectId('672c042aef61657e995126b6'),
    status: 'queued',
    stationId,
    lockedByStationId: stationId
  }
  const queuedRepairs = new Map([[
    'print_jobs',
    new Map([[String(queuedJob._id), [{
      path: 'stationId',
      key: mongoose.mongo.BSON.EJSON.stringify(stationId, null, 0, { relaxed: false })
    }]]])
  ]])
  clearMissingOptionalReferences(queuedJob, 'print_jobs', queuedRepairs)
  assert.equal(queuedJob.stationId, null)
  assert.equal(String(queuedJob.lockedByStationId), String(stationId))
})

test('canteen restore preserves absent historical customer and batch references', () => {
  const cases = [
    { sourceCollection: 'canteen_qr_orders', path: 'customerId' },
    { sourceCollection: 'canteen_qr_orders', path: 'cariId' },
    { sourceCollection: 'canteen_sales', path: 'items.batchId' }
  ]
  const missingId = new mongoose.Types.ObjectId('672c042aef61657e995126c1')

  for (const reference of cases) {
    assert.equal(getMissingReferenceHandling(reference, {}, 'canteen'), 'preserve-history')
    assert.equal(getMissingReferenceHandling(reference, {}, 'restaurant'), 'clear-optional')
  }

  const order = {
    _id: new mongoose.Types.ObjectId('672c042aef61657e995126c2'),
    customerId: missingId,
    cariId: missingId
  }
  const sale = {
    _id: new mongoose.Types.ObjectId('672c042aef61657e995126c3'),
    items: [{ batchId: missingId }, { batchId: null }]
  }
  const noRepairs = new Map()
  clearMissingOptionalReferences(order, 'canteen_qr_orders', noRepairs)
  clearMissingOptionalReferences(sale, 'canteen_sales', noRepairs)
  assert.equal(String(order.customerId), String(missingId))
  assert.equal(String(order.cariId), String(missingId))
  assert.equal(String(sale.items[0].batchId), String(missingId))
  assert.equal(sale.items[1].batchId, null)
})

test('canteen user branch references resolve only against canteen branches in the same tenant backup', () => {
  const branchId = new mongoose.Types.ObjectId('672c042aef61657e995126c4')
  const references = ['branchId', 'branchIds', 'accessibleBranchIds'].map((path) => ({
    sourceCollection: 'users',
    path,
    targetCollection: 'branches',
    required: false
  }))
  for (const reference of references) {
    assert.equal(resolveReferenceTargetCollection(reference, 'canteen'), 'canteen_branches')
    assert.equal(resolveReferenceTargetCollection(reference, 'restaurant'), 'branches')
    assert.equal(getMissingReferenceHandling(reference, {}, 'canteen'), 'preserve-history')
  }
  const parsed = {
    backup: {
      collections: {
        users: [{
          _id: new mongoose.Types.ObjectId('672c042aef61657e995126c5'),
          tenantId: tenantObjectId,
          branchId,
          branchIds: [branchId],
          accessibleBranchIds: [branchId]
        }]
      }
    },
    idsByCollection: new Map([['canteen_branches', new Set([String(branchId)])]])
  }
  const lookups = buildBackupReferenceLookupPlan(parsed, 'canteen', references)
  assert.equal(lookups.size, 0)
})

test('canteen historical reference lookup remains tenant-scoped and does not inspect restaurant collections', () => {
  const absentCustomerId = new mongoose.Types.ObjectId('672c042aef61657e995126c6')
  const absentBatchId = new mongoose.Types.ObjectId('672c042aef61657e995126c7')
  const parsed = {
    backup: {
      collections: {
        canteen_qr_orders: [{
          _id: new mongoose.Types.ObjectId('672c042aef61657e995126c8'),
          tenantId: tenantObjectId,
          customerId: absentCustomerId
        }],
        canteen_sales: [{
          _id: new mongoose.Types.ObjectId('672c042aef61657e995126c9'),
          tenantId: tenantObjectId,
          items: [{ batchId: absentBatchId }]
        }]
      }
    },
    idsByCollection: new Map([
      ['canteen_qr_orders', new Set()],
      ['canteen_sales', new Set()]
    ])
  }
  const references = [
    { sourceCollection: 'canteen_qr_orders', path: 'customerId', targetCollection: 'canteen_customers', required: false },
    { sourceCollection: 'canteen_sales', path: 'items.batchId', targetCollection: 'canteen_product_batches', required: false },
    { sourceCollection: 'orders', path: 'customerId', targetCollection: 'customeraccounts', required: false }
  ]

  const lookups = buildBackupReferenceLookupPlan(parsed, 'canteen', references)
  assert.deepEqual([...lookups.keys()], ['canteen_customers', 'canteen_product_batches'])
  assert.equal(lookups.get('canteen_customers').size, 1)
  assert.equal(lookups.get('canteen_product_batches').size, 1)
  assert.equal(
    classifyReferenceTargetOwnership({ tenantId: new mongoose.Types.ObjectId('672c042aef61657e995126ca') }, tenantId),
    'foreign'
  )
})

test('restore reference ownership rejects other tenants and distinguishes same-tenant targets', () => {
  assert.equal(classifyReferenceTargetOwnership({ _id: new mongoose.Types.ObjectId() }, tenantId), 'global')
  assert.equal(classifyReferenceTargetOwnership({ tenantId: tenantObjectId }, tenantId), 'tenant')
  assert.equal(
    classifyReferenceTargetOwnership({
      tenantId: tenantObjectId,
      tenant: new mongoose.Types.ObjectId('672c042aef61657e995126ae')
    }, tenantId),
    'foreign'
  )
  assert.equal(
    classifyReferenceTargetOwnership({
      tenantId: new mongoose.Types.ObjectId('672c042aef61657e995126ae')
    }, tenantId),
    'foreign'
  )
})

test('full tenant backup preserves BSON types, checksum, signature, and related unscoped preferences', () => {
  const archive = makeArchive()
  const input = Buffer.from(JSON.stringify(archive.backup), 'utf8')
  const parsed = parseAndVerifyTenantBackup(input, tenantId, 'restaurant')

  assert.equal(parsed.backup.tenant.id, tenantId)
  assert.deepEqual(parsed.backup.tenant.profile, {
    description: 'Örnek açıklama',
    phone: '5551234567',
    settings: { currency: 'TRY' },
    allowedBranchIds: [new mongoose.Types.ObjectId('672c042aef61657e995126ac')]
  })
  assert.equal(parsed.backup.collections.users[0].tenantId.toString(), tenantId)
  assert.ok(parsed.backup.collections.users[0]._id instanceof mongoose.Types.ObjectId)
  assert.ok(parsed.backup.collections.accountappearancepreferences[0].userId instanceof mongoose.Types.ObjectId)
  assert.equal(parsed.idsByCollection.get('users').size, 1)
  assert.equal(isTenantOwnedBackupDocument(parsed.backup.collections.users[0], tenantId), true)
  assert.equal(
    getTenantResetSnapshotHash({ orders: [{ _id: 'b' }, { _id: 'a' }] }, 'restaurant'),
    getTenantResetSnapshotHash({ orders: [{ _id: 'a' }, { _id: 'b' }] }, 'restaurant')
  )
  assert.notEqual(
    getTenantResetSnapshotHash(parsed.backup.collections, 'restaurant'),
    getTenantResetSnapshotHash({ ...parsed.backup.collections, orders: [{ _id: new mongoose.Types.ObjectId() }] }, 'restaurant')
  )
  assert.notEqual(
    getTenantResetSnapshotHash(parsed.backup.collections, 'restaurant', { allowedBranchIds: [new mongoose.Types.ObjectId('672c042aef61657e995126ac')] }),
    getTenantResetSnapshotHash(parsed.backup.collections, 'restaurant', { allowedBranchIds: [] })
  )
  for (const collection of [
    'branches',
    'membership_requests',
    'print_printers',
    'print_profiles',
    'print_stations',
    'payment_settings',
    'tenant_website_settings',
    'user_preferences'
  ]) {
    assert.notEqual(
      getTenantResetSnapshotHash({ [collection]: [{ _id: 'before' }] }, 'restaurant'),
      getTenantResetSnapshotHash({ [collection]: [{ _id: 'after' }] }, 'restaurant'),
      `${collection} must be included in reset backup coverage`
    )
  }
  for (const collection of ['audit_logs', 'tenant_usage_sessions', 'tenant_usage_dailies']) {
    assert.equal(
      getTenantResetSnapshotHash({ [collection]: [{ _id: 'before' }] }, 'restaurant'),
      getTenantResetSnapshotHash({ [collection]: [{ _id: 'after' }] }, 'restaurant'),
      `${collection} must not invalidate reset confirmation when system activity changes`
    )
  }
  assert.equal(
    getTenantResetSnapshotHash({ users: [{ _id: 'before' }], payment_requests: [{ _id: 'before' }] }, 'restaurant'),
    getTenantResetSnapshotHash({ users: [{ _id: 'after' }], payment_requests: [{ _id: 'after' }] }, 'restaurant')
  )

  const filter = buildTenantDataFilter(tenantId)
  assert.deepEqual(filter.$or.map((entry) => Object.keys(entry)[0]), ['tenantId', 'tenant'])
  assert.deepEqual(getReferencePaths().filter((entry) => entry.sourceCollection === 'accountappearancepreferences'), [
    { sourceCollection: 'accountappearancepreferences', path: 'userId', targetCollection: 'users', required: true }
  ])
})

test('backup parser rejects wrong tenant identity and modified or out-of-scope data', () => {
  const archive = makeArchive()
  const input = Buffer.from(JSON.stringify(archive.backup), 'utf8')
  assert.throws(() => parseAndVerifyTenantBackup(input, '672c042aef61657e995126ae', 'restaurant'), /different|farklı/i)
  assert.throws(() => parseAndVerifyTenantBackup(input, tenantId, 'canteen'), /different|farklı/i)
  const invalidTenantId = finalizeTenantBackup({
    ...archive.backup,
    tenant: { ...archive.backup.tenant, id: 'not-an-object-id' }
  }).backup
  assert.throws(
    () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(invalidTenantId)), tenantId, 'restaurant'),
    /schema|şeması/i
  )

  const tampered = structuredClone(archive.backup)
  tampered.collections.users[0].role = 'staff'
  assert.throws(
    () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(tampered)), tenantId, 'restaurant'),
    /integrity|bütünlük/i
  )

  const foreign = makeArchive().backup
  foreign.collections.users[0].tenantId.$oid = '672c042aef61657e995126ae'
  assert.throws(
    () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(foreign)), tenantId, 'restaurant'),
    /integrity|bütünlük|firma/i
  )
})

test('backup validation rejects tenant branch access references missing from its branch collection', () => {
  const archive = makeArchive().backup
  const content = {
    ...archive,
    tenant: {
      ...archive.tenant,
      profile: {
        ...archive.tenant.profile,
        allowedBranchIds: [new mongoose.Types.ObjectId('672c042aef61657e995126b9')]
      }
    }
  }
  delete content.checksum
  delete content.signature
  const malformedArchive = finalizeTenantBackup(content).backup
  assert.throws(
    () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(malformedArchive)), tenantId, 'restaurant'),
    /şube erişimleri/
  )
})

test('reset backup snapshot ignores only audit and usage activity after backup time', () => {
  const stable = {
    orders: [{ _id: 'order-1', total: 100 }],
    audit_logs: [{ _id: 'audit-1', action: 'tenant_full_backup_downloaded' }],
    tenant_usage_sessions: [{ _id: 'usage-1', durationSeconds: 10 }],
    tenant_usage_dailies: [{ _id: 'daily-1', durationSeconds: 10 }]
  }
  const updated = {
    ...stable,
    audit_logs: [...stable.audit_logs, { _id: 'audit-2', action: 'settings_updated' }],
    tenant_usage_sessions: [{ _id: 'usage-1', durationSeconds: 70 }],
    tenant_usage_dailies: [{ _id: 'daily-1', durationSeconds: 70 }]
  }

  assert.equal(
    getTenantResetSnapshotHash(stable, 'restaurant'),
    getTenantResetSnapshotHash(updated, 'restaurant')
  )
  assert.notEqual(
    getTenantResetSnapshotHash(stable, 'restaurant'),
    getTenantResetSnapshotHash({ ...updated, orders: [{ _id: 'order-1', total: 150 }] }, 'restaurant')
  )
})

test('backup parser rejects unrelated collections and unsupported shapes', () => {
  const valid = makeArchive().backup
  const invalidShape = { ...valid, collections: [] }
  assert.throws(() => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(invalidShape)), tenantId, 'restaurant'))

  const forbidden = {
    ...valid,
    collections: { ...valid.collections, tenants: [] }
  }
  const signatureSource = { ...forbidden }
  delete signatureSource.checksum
  delete signatureSource.signature
  const resignable = finalizeTenantBackup(signatureSource).backup
  assert.throws(() => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(resignable)), tenantId, 'restaurant'))
})
