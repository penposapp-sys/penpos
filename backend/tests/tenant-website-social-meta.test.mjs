import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTenantWebsiteSocialMetadata,
  injectTenantWebsiteSocialMetadata
} from '../src/utils/tenantWebsiteSocialMeta.js'
import Tenant from '../src/models/Tenant.js'
import TenantWebsiteSettings from '../src/models/TenantWebsiteSettings.js'
import {
  getPublicTenantWebsiteMetadataBySlugService,
  normalizeTenantWebsiteSlug,
  syncTenantWebsiteSlugForBusinessName
} from '../src/services/tenantWebsiteService.js'
import {
  findActiveTenantByPublicSlug,
  findPublicOnlineBranchBySlug
} from '../src/controllers/publicController.js'

const template = `<!doctype html>
<html lang="tr">
<head>
<title>PenPOS</title>
<meta name="description" content="PenPOS description" />
<meta property="og:title" content="PenPOS" />
<meta property="og:description" content="PenPOS description" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://penpos.cloud" />
<meta property="og:image" content="https://penpos.cloud/site-icon-512.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="PenPOS" />
<meta name="twitter:description" content="PenPOS description" />
<meta name="twitter:image" content="https://penpos.cloud/site-icon-512.png" />
<link rel="canonical" href="https://penpos.cloud/" />
</head><body><div id="root"></div></body></html>`

test('tenant social metadata prioritizes SEO copy and uses the tenant logo over the default', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: {
      name: 'Örnek Firma',
      logoUrl: '/uploads/tenant-123/logo.webp'
    },
    settings: {
      seo: { title: 'Örnek Firma | Özel Başlık', description: 'Özel firma açıklaması' },
      hero: { subtitle: 'Genel tanıtım' }
    },
    canonicalPath: '/weprestorant/ornek-firma'
  })

  assert.equal(metadata.title, 'Örnek Firma | Özel Başlık')
  assert.equal(metadata.description, 'Özel firma açıklaması')
  assert.equal(metadata.canonicalUrl, 'https://penpos.cloud/weprestorant/ornek-firma')
  assert.equal(metadata.imageUrl, 'https://penpos.cloud/api/uploads/tenant-123/logo.webp')

  const html = injectTenantWebsiteSocialMetadata(template, metadata)
  assert.match(html, /<title>Örnek Firma \| Özel Başlık<\/title>/)
  assert.match(html, /property="og:title" content="Örnek Firma \| Özel Başlık"/)
  assert.match(html, /property="og:description" content="Özel firma açıklaması"/)
  assert.match(html, /property="og:image" content="https:\/\/penpos\.cloud\/api\/uploads\/tenant-123\/logo\.webp"/)
  assert.match(html, /property="og:url" content="https:\/\/penpos\.cloud\/weprestorant\/ornek-firma"/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.match(html, /name="twitter:image" content="https:\/\/penpos\.cloud\/api\/uploads\/tenant-123\/logo\.webp"/)
  assert.match(html, /rel="canonical" href="https:\/\/penpos\.cloud\/weprestorant\/ornek-firma"/)
  assert.equal((html.match(/property="og:title"/g) || []).length, 1)
})

test('tenant social metadata falls back to tenant content and a public HTTPS image', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: { name: 'Yıldız Market', description: 'Yerel ürünler' },
    settings: {
      seo: { description: 'PenPOS web sitesi' },
      hero: { subtitle: 'Günlük taze ürünler' },
      sections: []
    },
    canonicalPath: '/wepmagaza/yildiz-market'
  })

  assert.equal(metadata.title, 'Yıldız Market')
  assert.equal(metadata.description, 'Günlük taze ürünler')
  assert.equal(metadata.imageUrl, 'https://penpos.cloud/site-icon-512.png')
  assert.ok(metadata.canonicalUrl.startsWith('https://'))
})

test('tenant social metadata prefers the website cover image over the tenant logo', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: {
      name: 'Örnek Restoran',
      logoUrl: '/uploads/tenant-123/logo.webp'
    },
    settings: {
      hero: {
        coverImageUrl: '/uploads/tenant-123/website-cover.webp'
      }
    },
    canonicalPath: '/weprestorant/ornek-restoran'
  })

  assert.equal(metadata.imageUrl, 'https://penpos.cloud/api/uploads/tenant-123/website-cover.webp')
  assert.equal(metadata.imageAlt, 'Örnek Restoran web sitesi kapak görseli')
})

test('tenant social metadata replaces a stale default title with the current business name', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: {
      name: 'Pendik Tanıtım Etkinlikleri',
      businessName: 'Pendik Tanıtım Etkinlikleri',
      slug: 'pendik-sofrasi',
      logoUrl: '/uploads/tenant-123/logo-current.webp'
    },
    settings: {
      seo: { title: 'Pendik Sofrası' }
    },
    canonicalPath: '/weprestorant/pendik-tanitim-etkinlikleri'
  })
  const html = injectTenantWebsiteSocialMetadata(template, metadata)

  assert.equal(metadata.title, 'Pendik Tanıtım Etkinlikleri')
  assert.equal(metadata.imageUrl, 'https://penpos.cloud/api/uploads/tenant-123/logo-current.webp')
  assert.match(html, /property="og:title" content="Pendik Tanıtım Etkinlikleri"/)
  assert.match(html, /property="og:image" content="https:\/\/penpos\.cloud\/api\/uploads\/tenant-123\/logo-current\.webp"/)
  assert.match(html, /property="og:url" content="https:\/\/penpos\.cloud\/weprestorant\/pendik-tanitim-etkinlikleri"/)
  assert.match(html, /name="twitter:title" content="Pendik Tanıtım Etkinlikleri"/)
  assert.match(html, /name="twitter:image" content="https:\/\/penpos\.cloud\/api\/uploads\/tenant-123\/logo-current\.webp"/)
})

test('tenant social metadata preserves custom SEO titles unrelated to the old slug', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: {
      name: 'Pendik Tanıtım Etkinlikleri',
      slug: 'pendik-sofrasi'
    },
    settings: { seo: { title: 'Pendik Etkinlikleri | Resmi Site' } },
    canonicalPath: '/weprestorant/pendik-tanitim-etkinlikleri'
  })

  assert.equal(metadata.title, 'Pendik Etkinlikleri | Resmi Site')
})

test('another tenant with the previous business name keeps its own social title', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: {
      name: 'Pendik Sofrası',
      slug: 'pendik-sofrasi'
    },
    settings: { seo: { title: 'Pendik Sofrası' } },
    canonicalPath: '/weprestorant/pendik-sofrasi'
  })

  assert.equal(metadata.title, 'Pendik Sofrası')
})

test('legacy business slug resolves the current public website metadata', async () => {
  const originalTenantFindOne = Tenant.findOne
  const originalWebsiteFindOne = TenantWebsiteSettings.findOne
  const tenant = {
    _id: 'tenant-123',
    name: 'Pendik Tanıtım Etkinlikleri',
    slug: 'pendik-sofrasi',
    settings: {
      business: { businessName: 'Pendik Tanıtım Etkinlikleri' },
      logo: { url: '/uploads/tenant-123/logo-current.webp' }
    },
    isActive: true,
    status: 'active'
  }
  const website = {
    tenantId: 'tenant-123',
    slug: 'pendik-tanitim-etkinlikleri',
    enabled: true,
    published: true,
    seo: { title: 'Pendik Sofrası' }
  }
  let tenantWebsiteLookup

  Tenant.findOne = (query) => ({
    select() { return this },
    lean: async () => {
      assert.ok(query.slug === 'pendik-sofrasi' || query._id === tenant._id)
      return tenant
    }
  })
  TenantWebsiteSettings.findOne = (query) => ({
    lean: async () => {
      if (query.tenantId) return website
      tenantWebsiteLookup = query
      return null
    }
  })

  try {
    const result = await getPublicTenantWebsiteMetadataBySlugService('pendik-sofrasi')
    assert.deepEqual(tenantWebsiteLookup, {
      $or: [{ slug: 'pendik-sofrasi' }, { legacySlugs: 'pendik-sofrasi' }]
    })
    assert.equal(result.settings.slug, 'pendik-tanitim-etkinlikleri')
    assert.equal(result.tenant.name, 'Pendik Tanıtım Etkinlikleri')
    assert.equal(result.tenant.logoUrl, '/uploads/tenant-123/logo-current.webp')
  } finally {
    Tenant.findOne = originalTenantFindOne
    TenantWebsiteSettings.findOne = originalWebsiteFindOne
  }
})

test('online public website slug resolves its tenant without changing branch parameters', async () => {
  const originalTenantFindOne = Tenant.findOne
  const originalWebsiteFindOne = TenantWebsiteSettings.findOne
  const tenant = { _id: 'tenant-123', slug: 'pendik-sofrasi' }
  const tenantFindQueries = []
  let websiteFindQuery

  Tenant.findOne = (query) => ({
    lean: async () => {
      tenantFindQueries.push(query)
      return tenant
    }
  })
  TenantWebsiteSettings.findOne = (query) => ({
    select() { return this },
    lean: async () => {
      websiteFindQuery = query
      return { tenantId: tenant._id }
    }
  })

  try {
    const result = await findActiveTenantByPublicSlug('pendik-tanitim-etkinlikleri')
    assert.deepEqual(tenantFindQueries[0], {
      $or: [
        { slug: 'pendik-tanitim-etkinlikleri' },
        { publicSlug: 'pendik-tanitim-etkinlikleri' }
      ],
      isActive: true,
      status: 'active'
    })
    assert.equal(tenantFindQueries.length, 1)
    assert.equal(websiteFindQuery, undefined)
    assert.equal(result, tenant)
  } finally {
    Tenant.findOne = originalTenantFindOne
    TenantWebsiteSettings.findOne = originalWebsiteFindOne
  }
})

test('online branch slug resolves by current branch name without exposing its id', () => {
  const branches = [
    { _id: 'branch-1', name: 'Aile Salonu' },
    { _id: 'branch-2', name: 'Erkek Kafeterya' }
  ]

  assert.equal(findPublicOnlineBranchBySlug(branches, 'erkek-kafeterya'), branches[1])
  assert.equal(findPublicOnlineBranchBySlug(branches, 'unknown-branch'), null)
  assert.equal(findPublicOnlineBranchBySlug([
    { _id: 'branch-1', name: 'Aile Salonu' },
    { _id: 'branch-2', name: 'Aile-Salonu' }
  ], 'aile-salonu'), null)
})

test('website slug follows the current business name and keeps the normalized old slug', async () => {
  assert.equal(
    normalizeTenantWebsiteSlug('Pendik Sofrası Arestoranı'),
    'pendik-sofrasi-arestorani'
  )

  const originalTenantFindOne = Tenant.findOne
  const originalWebsiteFindOne = TenantWebsiteSettings.findOne
  const originalWebsiteUpdateOne = TenantWebsiteSettings.updateOne
  const tenant = {
    _id: 'tenant-123',
    slug: 'pendik-sofrası',
    name: 'Pendik Tanıtım Etkinlikleri'
  }
  let websiteUpdate

  Tenant.findOne = () => ({
    select() { return this },
    lean: async () => null
  })
  TenantWebsiteSettings.findOne = (query) => ({
    select() { return this },
    lean: async () => query.tenantId
      === tenant._id
      ? { _id: 'website-123', slug: 'pendik-sofrası' }
      : null
  })
  TenantWebsiteSettings.updateOne = async (query, update) => {
    websiteUpdate = { query, update }
  }

  try {
    const slug = await syncTenantWebsiteSlugForBusinessName(tenant)
    assert.equal(slug, 'pendik-tanitim-etkinlikleri')
    assert.deepEqual(websiteUpdate, {
      query: { _id: 'website-123' },
      update: {
        $set: { slug: 'pendik-tanitim-etkinlikleri' },
        $addToSet: { legacySlugs: 'pendik-sofrasi' }
      }
    })
  } finally {
    Tenant.findOne = originalTenantFindOne
    TenantWebsiteSettings.findOne = originalWebsiteFindOne
    TenantWebsiteSettings.updateOne = originalWebsiteUpdateOne
  }
})

test('social metadata escapes tenant-provided values before inserting them into HTML', () => {
  const metadata = buildTenantWebsiteSocialMetadata({
    tenant: { name: 'Firma <script>alert(1)</script>' },
    settings: { seo: { title: 'Başlık "Özel"', description: 'Açıklama & detay' } },
    canonicalPath: '/weprestorant/firma'
  })
  const html = injectTenantWebsiteSocialMetadata(template, metadata)

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /Başlık &quot;Özel&quot;/)
  assert.match(html, /Açıklama &amp; detay/)
})
