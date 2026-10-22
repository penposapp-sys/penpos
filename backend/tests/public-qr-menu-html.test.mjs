import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import Tenant from '../src/models/Tenant.js'
import { renderPublicQrMenuHtml } from '../src/controllers/publicWebsiteHtmlController.js'

test('QR menu route renders QR-specific social metadata', async (t) => {
  const tenant = {
    _id: '64b000000000000000000001',
    slug: 'pendik-tanitim-etkinlikleri',
    publicSlug: 'pendik-tanitim-etkinlikleri',
    businessName: 'Pendik Tanıtım Etkinlikleri',
    name: 'PenPOS',
    isActive: true,
    status: 'active',
    logoUrl: '/uploads/tenant-logo.png'
  }
  t.mock.method(Tenant, 'findOne', () => ({ lean: async () => tenant }))

  const response = {
    headers: {},
    set(name, value) { this.headers[name] = value; return this },
    type(value) { this.contentType = value; return this },
    send(value) { this.html = value; return this },
    status(value) { this.statusCode = value; return this }
  }
  await renderPublicQrMenuHtml({ params: { tenantSlug: tenant.publicSlug } }, response)

  assert.equal(response.contentType, 'html')
  assert.match(response.html, /<title>Pendik Tanıtım Etkinlikleri \| QR Menü<\/title>/)
  assert.match(response.html, /property="og:title" content="Pendik Tanıtım Etkinlikleri \| QR Menü"/)
  assert.match(response.html, /property="og:description" content="Pendik Tanıtım Etkinlikleri QR menüsünü görüntüleyin\."/)
  assert.match(response.html, /property="og:url" content="https:\/\/penpos\.cloud\/menu\/pendik-tanitim-etkinlikleri"/)
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0')
})

test('Nginx sends both QR menu URL shapes to the metadata renderer', async () => {
  const config = await readFile(new URL('../deploy/nginx/penpos-public-websites.conf', import.meta.url), 'utf8')
  assert.ok(config.split(/\r?\n/).some((line) => line.trim() === 'location ~ ^/menu/[^/]+(?:/[^/]+/[^/]+)?/?$ {'))
  const locationRegex = /^\/menu\/[^/]+(?:\/[^/]+\/[^/]+)?\/?$/
  assert.equal(locationRegex.test('/menu/pendik-tanitim-etkinlikleri'), true)
  assert.equal(locationRegex.test('/menu/pendik-tanitim-etkinlikleri/pendik/masa-1'), true)
})
