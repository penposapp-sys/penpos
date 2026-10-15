import assert from 'node:assert/strict'
import { test } from 'node:test'
import Branch from '../src/models/Branch.js'
import Tenant from '../src/models/Tenant.js'
import TenantWebsiteSettings from '../src/models/TenantWebsiteSettings.js'
import {
  getPublicTenantWebsiteBySlugService,
  updateTenantWebsiteSettingsService
} from '../src/services/tenantWebsiteService.js'

const tenantId = '64b000000000000000000001'
const branchId = '64b000000000000000000002'

const query = (value) => {
  const result = {
    sort() { return result },
    limit() { return result },
    select() { return result },
    lean() { return Promise.resolve(value) },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject) }
  }
  return result
}

const mockWebsite = (t, { tenant = {}, branch, branches = [], website: websiteOverrides = {} } = {}) => {
  const branchQueries = { one: [], many: [] }
  const websiteQueries = []
  const website = {
    tenantId,
    slug: 'example-restaurant',
    enabled: true,
    published: true,
    integrations: { showProducts: false },
    ...websiteOverrides
  }
  const resolvedTenant = {
    _id: tenantId,
    name: 'Example Restaurant',
    systemType: 'restaurant',
    isActive: true,
    status: 'active',
    settings: {},
    ...tenant
  }
  t.mock.method(TenantWebsiteSettings, 'findOne', (filter) => {
    websiteQueries.push(filter)
    return query(website)
  })
  t.mock.method(Tenant, 'findOne', () => query(resolvedTenant))
  t.mock.method(Branch, 'findOne', (filter) => {
    branchQueries.one.push(filter)
    return query(branch || null)
  })
  t.mock.method(Branch, 'find', (filter) => {
    branchQueries.many.push(filter)
    return query(branches)
  })
  return { website, resolvedTenant, branchQueries, websiteQueries }
}

test('Pendik Tanıtım Etkinlikleri slug resolves only for its explicitly published site record', async (t) => {
  const { websiteQueries } = mockWebsite(t, {
    tenant: { name: 'Pendik Tanıtım Etkinlikleri' },
    website: { slug: 'pendik-tanitim-etkinlikleri', enabled: true, published: true }
  })

  const payload = await getPublicTenantWebsiteBySlugService('Pendik-Tanitim-Etkinlikleri', 'restaurant')

  assert.deepEqual(websiteQueries[0], { slug: 'pendik-tanitim-etkinlikleri' })
  assert.equal(payload.tenant.name, 'Pendik Tanıtım Etkinlikleri')
  assert.equal(payload.settings.slug, 'pendik-tanitim-etkinlikleri')
  assert.equal(payload.settings.enabled, true)
  assert.equal(payload.settings.published, true)
})

test('Pendik Tanıtım Etkinlikleri remains unavailable when its persisted publication flag is false', async (t) => {
  const { websiteQueries } = mockWebsite(t, {
    website: { slug: 'pendik-tanitim-etkinlikleri', enabled: true, published: false }
  })

  await assert.rejects(
    getPublicTenantWebsiteBySlugService('pendik-tanitim-etkinlikleri', 'restaurant'),
    (err) => err?.status === 404 && err?.payload?.error === 'site_unpublished'
  )
  assert.deepEqual(websiteQueries[0], { slug: 'pendik-tanitim-etkinlikleri' })
})

test('public site enables reservations on the configured branch belonging to its tenant', async (t) => {
  const { branchQueries } = mockWebsite(t, {
    tenant: { settings: { onlineSales: { branchId } } },
    branch: { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: true } }
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.reservationsEnabled, true)
  assert.equal(String(branchQueries.one[0]._id), branchId)
  assert.equal(String(branchQueries.one[0].tenantId), tenantId)
  assert.equal(branchQueries.one[0].isActive, true)
})

test('public site keeps reservations hidden when the resolved branch setting is disabled', async (t) => {
  mockWebsite(t, {
    tenant: { settings: { onlineSales: { branchId } } },
    branch: { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: false } }
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.reservationsEnabled, false)
})

test('legacy restaurant websites default the reservation button to visible without changing other action defaults', async (t) => {
  const { website } = mockWebsite(t)
  website.integrations = { showProducts: false }

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.settings.integrations.showReservationButton, true)
  assert.equal(payload.settings.integrations.showQrMenu, true)
  assert.equal(payload.settings.integrations.showOnlineOrder, false)
  assert.equal(payload.reservationsEnabled, false)
})

test('public site respects an explicitly enabled reservation button setting', async (t) => {
  mockWebsite(t, {
    website: { integrations: { showProducts: false, showReservationButton: true } },
    tenant: { settings: { onlineSales: { branchId } } },
    branch: { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: true } }
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.settings.integrations.showReservationButton, true)
  assert.equal(payload.reservationsEnabled, true)
})

test('public site respects an explicitly disabled reservation button setting', async (t) => {
  mockWebsite(t, {
    website: { integrations: { showProducts: false, showReservationButton: false } },
    tenant: { settings: { onlineSales: { branchId } } },
    branch: { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: true } }
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.settings.integrations.showReservationButton, false)
  assert.equal(payload.reservationsEnabled, true)
})

test('website editor reservation button setting is persisted by tenant website update', async (t) => {
  const { resolvedTenant, website } = mockWebsite(t)
  t.mock.method(Tenant, 'findById', () => query(resolvedTenant))
  let savedUpdate
  t.mock.method(TenantWebsiteSettings, 'findOne', (filter) => query(filter?.tenantId?.$ne ? null : website))
  t.mock.method(TenantWebsiteSettings, 'findOneAndUpdate', (_filter, update) => {
    savedUpdate = update
    return query({ ...website, ...update.$set })
  })

  const result = await updateTenantWebsiteSettingsService({
    tenantId,
    payload: {
      slug: 'example-restaurant',
      integrations: { showQrMenu: false, showOnlineOrder: true, showReservationButton: false }
    }
  })

  assert.equal(savedUpdate.$set.integrations.showReservationButton, false)
  assert.equal(savedUpdate.$set.integrations.showQrMenu, false)
  assert.equal(savedUpdate.$set.integrations.showOnlineOrder, true)
  assert.equal(result.settings.integrations.showReservationButton, false)
})

test('public site uses the only active tenant branch when no online-sales branch is selected', async (t) => {
  const branch = { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: true } }
  mockWebsite(t, { branches: [branch] })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.reservationsEnabled, true)
})

test('public site does not guess a reservation branch when multiple branches are unconfigured', async (t) => {
  mockWebsite(t, {
    branches: [
      { _id: branchId, tenantId, isActive: true, reservationSettings: { onlineEnabled: true } },
      { _id: '64b000000000000000000008', tenantId, isActive: true, reservationSettings: { onlineEnabled: true } }
    ]
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.reservationsEnabled, false)
})

test('canteen/market tenant does not receive restaurant reservation capability', async (t) => {
  const { branchQueries } = mockWebsite(t, {
    tenant: { systemType: undefined, businessType: 'store' }
  })

  const payload = await getPublicTenantWebsiteBySlugService('example-restaurant')

  assert.equal(payload.reservationsEnabled, false)
  assert.equal(branchQueries.one.length, 0)
  assert.equal(branchQueries.many.length, 0)
})
