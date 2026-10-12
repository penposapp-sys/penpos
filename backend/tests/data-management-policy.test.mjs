import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DATA_MANAGEMENT_ACTIONS,
  getDataManagementPolicy,
  getTenantResetDeletionPlan,
  getResetComparableCounts,
  getProductDetailUpdate,
  isCollectionPreservedOnReset,
  isCollectionVolatileDuringReset,
  resetCountsMatch
} from '../src/services/dataManagementPolicy.js'

test('data-management policies only target operational records for each system', () => {
  assert.deepEqual(DATA_MANAGEMENT_ACTIONS, ['cash', 'productDetails', 'reset'])
  assert.deepEqual(getDataManagementPolicy('restaurant', 'cash'), [
    'orders',
    'orderCounters',
    'kitchenBulkPrepStates'
  ])
  assert.deepEqual(getDataManagementPolicy('canteen', 'cash'), ['canteenSales', 'canteenQrOrders'])
  assert.deepEqual(getDataManagementPolicy('restaurant', 'reset'), [])
  assert.deepEqual(getDataManagementPolicy('canteen', 'reset'), [])

  const protectedCollections = [
    'customerAccounts',
    'accountTransactions',
    'canteenCustomers',
    'canteenCustomerCollections',
    'menuItems',
    'canteenProducts',
    'canteenProductBatches',
    'branches',
    'canteenBranches',
    'users',
    'tenants'
  ]
  for (const system of ['restaurant', 'canteen']) {
    for (const action of DATA_MANAGEMENT_ACTIONS) {
      assert.equal(
        getDataManagementPolicy(system, action).some((collection) => protectedCollections.includes(collection)),
        false
      )
    }
  }
  assert.equal(getDataManagementPolicy('anaokulu', 'reset'), null)
  assert.equal(getDataManagementPolicy('restaurant', 'unknown'), null)
  for (const collection of ['users', 'payment_requests']) {
    assert.equal(isCollectionPreservedOnReset(collection), true)
  }
  for (const collection of [
    'orders',
    'menu_items',
    'customer_accounts',
    'account_transactions',
    'canteen_sales',
    'canteen_products',
    'canteen_stock_movements',
    'branches',
    'canteen_branches',
    'payment_settings',
    'audit_logs',
    'tenant_usage_daily',
    'tenant_usage_sessions',
    'membership_requests',
    'print_printers',
    'print_profiles',
    'print_stations',
    'print_jobs',
    'tenant_website_settings',
    'user_preferences',
    'account_appearance_preferences',
    'luca_extension_devices'
  ]) {
    assert.equal(isCollectionPreservedOnReset(collection), false)
  }
  assert.deepEqual(
    getTenantResetDeletionPlan([
      { name: 'users', docs: [] },
      { name: 'branches', docs: [] },
      { name: 'payment_requests', docs: [] },
      { name: 'audit_logs', docs: [] },
      { name: 'account_transactions', docs: [] },
      { name: 'canteen_products', docs: [] }
    ], 'restaurant').map(({ name }) => name),
    ['branches', 'audit_logs', 'account_transactions']
  )
})

test('product-detail cleanup preserves sale totals and account ledgers', () => {
  assert.deepEqual(getProductDetailUpdate('orders'), {
    $set: { items: [], 'payments.$[].itemAllocations': [] }
  })
  assert.deepEqual(getProductDetailUpdate('canteenSales'), { $set: { items: [] } })
  assert.deepEqual(getProductDetailUpdate('canteenQrOrders'), { $set: { items: [] } })
  assert.equal(getProductDetailUpdate('accountTransactions'), null)
})

test('reset comparisons ignore only audit and usage records that the app updates itself', () => {
  const previewCounts = {
    orders: 4,
    audit_logs: 10,
    tenant_usage_sessions: 2,
    tenant_usage_dailies: 1,
    branches: 3
  }
  const currentCounts = {
    orders: 4,
    audit_logs: 15,
    tenant_usage_sessions: 2,
    tenant_usage_dailies: 1,
    branches: 3
  }

  assert.equal(isCollectionVolatileDuringReset('audit_logs'), true)
  assert.equal(isCollectionVolatileDuringReset('tenant_usage_sessions'), true)
  assert.equal(isCollectionVolatileDuringReset('tenant_usage_dailies'), true)
  assert.equal(isCollectionVolatileDuringReset('orders'), false)
  assert.deepEqual(getResetComparableCounts(previewCounts), {
    orders: 4,
    branches: 3
  })
  assert.deepEqual(getResetComparableCounts(currentCounts), getResetComparableCounts(previewCounts))
  assert.equal(resetCountsMatch(previewCounts, currentCounts), true)
  assert.notDeepEqual(
    getResetComparableCounts({ ...currentCounts, orders: 5 }),
    getResetComparableCounts(previewCounts)
  )
  assert.equal(resetCountsMatch(previewCounts, { ...currentCounts, orders: 5 }), false)
  assert.equal(resetCountsMatch(undefined, currentCounts), false)
})
