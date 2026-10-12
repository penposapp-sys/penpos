import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import '../src/app.js'
import {
  classifyTenantCollection,
  getSystemDiscriminatorFilter,
  isCollectionInSystemScope
} from '../src/services/dataManagementScope.js'
import { getTenantResetDeletionPlan } from '../src/services/dataManagementPolicy.js'
import { finalizeTenantBackup, parseAndVerifyTenantBackup } from '../src/services/tenantBackupService.js'

const SYSTEM_COLLECTIONS = {
  restaurant: ['orders', 'menuitems', 'branches', 'accounttransactions'],
  canteen: ['canteen_sales', 'canteen_products', 'canteen_branches', 'canteen_stock_movements'],
  anaokulu: ['anaokuluschools']
}
const RESETTABLE_SHARED_COLLECTIONS = [
  'audit_logs',
  'tenant_usage_sessions',
  'tenant_usage_dailies',
  'membership_requests',
  'print_jobs',
  'print_printers',
  'print_profiles',
  'print_stations',
  'tenant_website_settings',
  'user_preferences',
  'account_appearance_preferences',
  'luca_extension_devices'
]

test('each system scope includes its own data and excludes both other business systems', () => {
  for (const [system, ownCollections] of Object.entries(SYSTEM_COLLECTIONS)) {
    for (const name of ownCollections) assert.equal(isCollectionInSystemScope(name, system), true, `${system} should include ${name}`)
    for (const [otherSystem, collections] of Object.entries(SYSTEM_COLLECTIONS)) {
      if (otherSystem === system) continue
      for (const name of collections) assert.equal(isCollectionInSystemScope(name, system), false, `${system} must exclude ${name}`)
    }
    assert.equal(isCollectionInSystemScope('future_unmapped_records', system), false)
    assert.equal(isCollectionInSystemScope('users', system), true)
  }
  assert.equal(isCollectionInSystemScope('users', 'unrecognized-system'), false)
})

test('all registered tenant-scoped models have an explicit scope classification', () => {
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName)
    let tenantScoped = false
    model.schema.eachPath((path) => {
      if (path === 'tenantId' || path === 'tenant') tenantScoped = true
    })
    if (tenantScoped) {
      assert.notEqual(
        classifyTenantCollection(model.collection.collectionName).kind,
        'unknown',
        `${model.collection.collectionName} needs an explicit system scope`
      )
    }
  }
})

test('shared print and user records are filtered by the selected tenant system', () => {
  assert.deepEqual(getSystemDiscriminatorFilter('print_jobs', 'restaurant'), {
    system: { $in: ['kermes', 'restaurant', 'restoran'] }
  })
  assert.deepEqual(getSystemDiscriminatorFilter('print_stations', 'canteen'), {
    system: { $in: ['canteen', 'kantin', 'market'] }
  })
  assert.deepEqual(getSystemDiscriminatorFilter('users', 'anaokulu'), {
    $or: [
      { systemType: { $in: ['anaokulu', 'kindergarten', 'kres'] } },
      { systemType: null },
      { systemType: { $exists: false } }
    ]
  })
  assert.equal(getSystemDiscriminatorFilter('orders', 'restaurant'), null)
})

test('reset plans only include known deletable collections from the selected system', () => {
  const candidates = [
    ...Object.values(SYSTEM_COLLECTIONS).flat().map((name) => ({ name, docs: [{ _id: name }] })),
    ...RESETTABLE_SHARED_COLLECTIONS.map((name) => ({ name, docs: [{ _id: name }] })),
    { name: 'users', docs: [{ _id: 'user' }] },
    { name: 'payment_requests', docs: [{ _id: 'payment' }] },
    { name: 'future_unmapped_records', docs: [{ _id: 'unknown' }] }
  ]

  for (const [system, ownCollections] of Object.entries(SYSTEM_COLLECTIONS)) {
    const planned = getTenantResetDeletionPlan(candidates, system).map(({ name }) => name)
    for (const ownCollection of ownCollections) assert.ok(planned.includes(ownCollection), `${system} reset must include ${ownCollection}`)
    for (const sharedCollection of RESETTABLE_SHARED_COLLECTIONS) assert.ok(planned.includes(sharedCollection), `${system} reset must include ${sharedCollection}`)
    for (const [otherSystem, otherCollections] of Object.entries(SYSTEM_COLLECTIONS)) {
      if (otherSystem === system) continue
      for (const otherCollection of otherCollections) assert.equal(planned.includes(otherCollection), false, `${system} reset must exclude ${otherCollection}`)
    }
    assert.equal(planned.includes('users'), false)
    assert.equal(planned.includes('payment_requests'), false)
    assert.equal(planned.includes('future_unmapped_records'), false)
  }
  assert.deepEqual(getTenantResetDeletionPlan(candidates).map(({ name }) => name), [])
})

test('restore rejects collections belonging to another system or without an explicit scope', () => {
  const tenantId = '672c042aef61657e995126ac'
  const exampleCollection = {
    restaurant: 'orders',
    canteen: 'canteen_sales',
    anaokulu: 'anaokuluschools'
  }

  for (const [system, ownCollection] of Object.entries(exampleCollection)) {
    for (const [otherSystem, otherCollection] of Object.entries(exampleCollection)) {
      if (system === otherSystem) continue
      const archive = finalizeTenantBackup({
        format: 'penpos-tenant-full-backup',
        version: 1,
        createdAt: '2026-10-12T00:00:00.000Z',
        tenant: { id: tenantId, name: 'Örnek Firma', system },
        collections: { [otherCollection]: [] }
      }).backup
      assert.throws(
        () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(archive)), tenantId, system),
        /işletme türüne ait/
      )
    }

    const unknownArchive = finalizeTenantBackup({
      format: 'penpos-tenant-full-backup',
      version: 1,
      createdAt: '2026-10-12T00:00:00.000Z',
      tenant: { id: tenantId, name: 'Örnek Firma', system },
      collections: { [ownCollection]: [], future_unmapped_records: [] }
    }).backup
    assert.throws(
      () => parseAndVerifyTenantBackup(Buffer.from(JSON.stringify(unknownArchive)), tenantId, system),
      /kapsamı tanımlı değil/
    )
  }
})
