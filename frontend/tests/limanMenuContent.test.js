import assert from 'node:assert/strict'
import test from 'node:test'
import { applyLimanMenuContent, normalizeLimanMenuText } from '../src/pages/limanMenuContent.js'
import { buildSafeBusinessSettings, defaultBusinessSettings, mergeBusinessSettings } from '../src/lib/businessSettings.js'

test('keeps tenant category and product content while applying saved order', () => {
  const categories = [
    { id: 'drinks', name: 'İçecekler', sortOrder: 0 },
    { id: 'food', name: 'Ev Yemekleri', sortOrder: 1 }
  ]
  const items = [
    { id: 'tea', categoryId: 'drinks', name: 'Çay', description: 'Demlik çay', price: 15, imageUrl: '/uploads/tea.webp' },
    { id: 'soup', categoryId: 'food', name: 'Mercimek', description: 'Günlük çorba', price: 80, imageUrl: '' }
  ]

  const result = applyLimanMenuContent(categories, items, { categoryOrder: ['food', 'drinks'] })

  assert.deepEqual(result.categories.map(({ id, name }) => [id, name]), [
    ['food', 'Ev Yemekleri'],
    ['drinks', 'İçecekler']
  ])
  assert.deepEqual(result.items, [
    { ...items[0], categoryName: 'İçecekler' },
    { ...items[1], categoryName: 'Ev Yemekleri' }
  ])
})

test('hides configured categories and their products without changing source records', () => {
  const categories = [
    { id: 'visible', name: 'Kahvaltı' },
    { id: 'hidden', name: 'Kampanya' }
  ]
  const items = [
    { id: 'one', categoryId: 'visible', name: 'Serpme' },
    { id: 'two', categoryId: 'hidden', name: 'Örnek' }
  ]

  const result = applyLimanMenuContent(categories, items, { hiddenCategoryIds: ['hidden'] })

  assert.deepEqual(result.categories.map(({ id }) => id), ['visible'])
  assert.deepEqual(result.items.map(({ id }) => id), ['one'])
  assert.equal(categories.length, 2)
  assert.equal(items.length, 2)
})

test('does not introduce example tenant content and keeps Turkish text intact', () => {
  const input = [{ id: '1', categoryId: 'a', name: 'SPOONFULL', description: 'Günün özel tatlısı', price: 125 }]
  const result = applyLimanMenuContent([{ id: 'a', name: 'Tatlılar' }], input)

  assert.deepEqual(result.items[0], { ...input[0], categoryName: 'Tatlılar' })
  assert.equal(result.items.some((item) => item.name === 'Talebeye İkram'), false)
  assert.equal(normalizeLimanMenuText('İÇLİ KÖFTE ADET'), 'icli kofte adet')
})

test('new and existing tenants receive isolated default Liman display settings', () => {
  const defaultQrMenu = defaultBusinessSettings.qrMenu
  const existingSettings = mergeBusinessSettings({ business: { businessName: 'Kendi İşletmem' } })
  const anotherTenantSettings = mergeBusinessSettings({ business: { businessName: 'Başka İşletme' } })

  assert.equal(defaultQrMenu.palette, 'liman')
  assert.equal(defaultQrMenu.fontFamily, 'instrument')
  assert.equal(defaultQrMenu.showPrices, false)
  assert.deepEqual(defaultQrMenu.categoryOrder, [])
  assert.notEqual(existingSettings.qrMenu.categoryOrder, anotherTenantSettings.qrMenu.categoryOrder)
  assert.notEqual(existingSettings.qrMenu.hiddenCategoryIds, anotherTenantSettings.qrMenu.hiddenCategoryIds)
  assert.equal(existingSettings.qrMenu.title, '')
  assert.equal(existingSettings.qrMenu.featuredImageUrl, '')
})

test('QR menu appearance settings survive save and reload merging', () => {
  const settings = mergeBusinessSettings({ business: { businessName: 'Menüm' } })
  const saved = buildSafeBusinessSettings(settings, {
    qrMenu: {
      ...settings.qrMenu,
      title: 'Günlük Menü',
      palette: 'olive',
      fontFamily: 'serif',
      categoryOrder: ['category-2', 'category-1'],
      hiddenCategoryIds: ['category-3'],
      featuredEnabled: false,
      showPrices: true,
    },
  })
  const reloaded = mergeBusinessSettings(saved)

  assert.equal(reloaded.qrMenu.title, 'Günlük Menü')
  assert.equal(reloaded.qrMenu.palette, 'olive')
  assert.equal(reloaded.qrMenu.fontFamily, 'serif')
  assert.deepEqual(reloaded.qrMenu.categoryOrder, ['category-2', 'category-1'])
  assert.deepEqual(reloaded.qrMenu.hiddenCategoryIds, ['category-3'])
  assert.equal(reloaded.qrMenu.featuredEnabled, false)
  assert.equal(reloaded.qrMenu.showPrices, true)
})

test('header and footer copy can be customized per tenant and cleared', () => {
  const settings = mergeBusinessSettings({})
  const saved = buildSafeBusinessSettings(settings, {
    qrMenu: {
      ...settings.qrMenu,
      brandLabel: 'Yeni üst yazı',
      title: 'Yeni menü adı',
      subtitle: 'Yeni vurgu',
      description: 'Yeni açıklama',
      footerGreeting: 'Güzel günler',
      footerText: 'İletişim bilgileri',
    },
  })
  const customized = mergeBusinessSettings(saved).qrMenu

  assert.equal(customized.brandLabel, 'Yeni üst yazı')
  assert.equal(customized.title, 'Yeni menü adı')
  assert.equal(customized.subtitle, 'Yeni vurgu')
  assert.equal(customized.description, 'Yeni açıklama')
  assert.equal(customized.footerGreeting, 'Güzel günler')
  assert.equal(customized.footerText, 'İletişim bilgileri')

  const cleared = mergeBusinessSettings(buildSafeBusinessSettings(saved, {
    qrMenu: {
      ...saved.qrMenu,
      brandLabel: '',
      footerGreeting: '',
      footerText: '',
    },
  })).qrMenu

  assert.equal(cleared.brandLabel, '')
  assert.equal(cleared.footerGreeting, '')
  assert.equal(cleared.footerText, '')
})
