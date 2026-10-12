import { normalizeSystemType } from '../utils/systemType.js'
import { normalizeCollectionName } from './collectionName.js'

const SYSTEM_COLLECTIONS = Object.freeze({
  restaurant: [
    'tables',
    'categories',
    'menuitems',
    'orders',
    'ordercounters',
    'waitercalls',
    'kitchenbulkprepstates',
    'deliverycustomers',
    'branches',
    'paymentsettings',
    'customeraccounts',
    'accounttransactions'
  ],
  canteen: [
    'canteensales',
    'canteenqrorders',
    'canteencategories',
    'canteenproducts',
    'canteenbranches',
    'canteentenantsettings',
    'canteentenantpaymentsettings',
    'canteencustomers',
    'canteencustomercollections',
    'canteenproductbatches',
    'canteenstockmovements',
    'canteenstockcount_sessions',
    'canteenstockcount_items'
  ],
  anaokulu: [
    'anaokuluschools'
  ]
})

const COMMON_COLLECTIONS = new Set([
  'users',
  'auditlogs',
  'tenantusagedailies',
  'tenantusagesessions',
  'paymentrequests',
  'membershiprequests',
  'tenantwebsitesettings',
  'userpreferences',
  'accountappearancepreferences',
  'lucaextensiondevices',
  'printjobs',
  'printprinters',
  'printprofiles',
  'printstations'
])

const SYSTEM_DISCRIMINATOR_COLLECTIONS = new Set([
  'users',
  'printjobs',
  'printprinters',
  'printprofiles',
  'printstations'
])

const SYSTEM_ALIASES = Object.freeze({
  restaurant: ['kermes', 'restaurant', 'restoran'],
  canteen: ['canteen', 'kantin', 'market'],
  anaokulu: ['anaokulu', 'kindergarten', 'kres']
})

const systemByCollection = new Map(
  Object.entries(SYSTEM_COLLECTIONS)
    .flatMap(([system, names]) => names.map((name) => [normalizeCollectionName(name), system]))
)

export const classifyTenantCollection = (name) => {
  const normalized = normalizeCollectionName(name)
  const system = systemByCollection.get(normalized)
  if (system) return { kind: 'system', system }
  if (COMMON_COLLECTIONS.has(normalized)) return { kind: 'shared', system: null }
  return { kind: 'unknown', system: null }
}

export const isCollectionInSystemScope = (name, system) => {
  const normalizedSystem = normalizeSystemType(system)
  if (!normalizedSystem) return false
  const classification = classifyTenantCollection(name)
  return classification.kind === 'shared' ||
    (classification.kind === 'system' && classification.system === normalizedSystem)
}

export const getSystemDiscriminatorFilter = (name, system) => {
  if (!SYSTEM_DISCRIMINATOR_COLLECTIONS.has(normalizeCollectionName(name))) return null
  const normalizedSystem = normalizeSystemType(system)
  const aliases = SYSTEM_ALIASES[normalizedSystem]
  if (!aliases) return null
  if (normalizeCollectionName(name) === 'users') {
    return {
      $or: [
        { systemType: { $in: aliases } },
        { systemType: null },
        { systemType: { $exists: false } }
      ]
    }
  }
  return { system: { $in: aliases } }
}
