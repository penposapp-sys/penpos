import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTenantWebsiteSocialMetadata,
  injectTenantWebsiteSocialMetadata
} from '../src/utils/tenantWebsiteSocialMeta.js'

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
