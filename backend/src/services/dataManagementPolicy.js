import { normalizeCollectionName } from './collectionName.js'
import { isCollectionInSystemScope } from './dataManagementScope.js'

const POLICIES = {
  restaurant: {
    cash: ['orders', 'orderCounters', 'kitchenBulkPrepStates'],
    productDetails: ['orders'],
    reset: []
  },
  canteen: {
    cash: ['canteenSales', 'canteenQrOrders'],
    productDetails: ['canteenSales', 'canteenQrOrders'],
    reset: []
  }
}

export const DATA_MANAGEMENT_ACTIONS = Object.freeze(['cash', 'productDetails', 'reset'])

export const getDataManagementPolicy = (system, action) => {
  const policy = POLICIES[system]?.[action]
  if (!policy) return null
  return [...policy]
}

export const getProductDetailUpdate = (collectionKey) => {
  if (collectionKey === 'orders') {
    return { $set: { items: [], 'payments.$[].itemAllocations': [] } }
  }
  if (collectionKey === 'canteenSales' || collectionKey === 'canteenQrOrders') {
    return { $set: { items: [] } }
  }
  return null
}

export const RESET_PRESERVED_COLLECTIONS = Object.freeze([
  'users',
  'paymentrequests'
])

export const isCollectionPreservedOnReset = (name) =>
  RESET_PRESERVED_COLLECTIONS.includes(normalizeCollectionName(name))

export const isCollectionVolatileDuringReset = (name) =>
  ['auditlogs', 'tenantusagesessions', 'tenantusagedailies'].includes(normalizeCollectionName(name))

export const getResetComparableCounts = (counts) => Object.fromEntries(
  Object.entries(counts || {}).filter(([name]) => !isCollectionVolatileDuringReset(name))
)

export const resetCountsMatch = (expected, actual) => {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return false
  const comparableExpected = getResetComparableCounts(expected)
  const comparableActual = getResetComparableCounts(actual)
  const expectedKeys = Object.keys(comparableExpected).sort()
  const actualKeys = Object.keys(comparableActual).sort()
  return expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) =>
      key === actualKeys[index] && Number(comparableExpected[key]) === comparableActual[key]
    )
}

export { normalizeCollectionName }

export const getTenantResetDeletionPlan = (collections, system) =>
  collections.filter(({ name }) =>
    isCollectionInSystemScope(name, system) && !isCollectionPreservedOnReset(name)
  )
