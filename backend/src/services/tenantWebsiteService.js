import mongoose from 'mongoose'
import TenantWebsiteSettings from '../models/TenantWebsiteSettings.js'
import Tenant from '../models/Tenant.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import WebsiteSettings from '../models/WebsiteSettings.js'
import CanteenTenantSettings from '../modules/canteen/models/CanteenTenantSettings.js'
import CanteenBranch from '../modules/canteen/models/CanteenBranch.js'
import CanteenCategory from '../modules/canteen/models/CanteenCategory.js'
import CanteenProduct from '../modules/canteen/models/CanteenProduct.js'
import { error } from '../utils/errors.js'
import { mergeBusinessSettings } from '../utils/businessSettings.js'
import { notDeletedFilter } from '../utils/softDelete.js'
import { getDefaultWebsiteSettings, normalizeWebsiteSettings } from './websiteSettingsService.js'

const SECTION_TYPES = ['hero', 'products', 'about', 'contact', 'map', 'social', 'buttons', 'qrMenu', 'onlineOrder', 'customText']

const DEFAULT_THEME = {
  backgroundColor: '#e5e7eb',
  textColor: '#111827',
  primaryColor: '#d1d5db',
  secondaryColor: '#9ca3af',
  buttonColor: '#d1d5db',
  buttonTextColor: '#111827',
  cardColor: 'rgba(255,255,255,0.82)',
  borderRadius: 24,
  fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif'
}

const DEFAULT_LAYOUT = {
  maxWidth: '1180px',
  headerStyle: 'centered',
  sectionSpacing: 32,
  contentAlign: 'left'
}

const DEFAULT_HERO = {
  visible: true,
  title: 'İşletmenizin dijital vitrini',
  subtitle: 'Menümüzü inceleyin, bize kolayca ulaşın.',
  kickerText: 'Cafe · Restoran · Isletmeniz',
  logoUrl: '',
  coverImageUrl: '',
  galleryImages: [],
  backgroundColor: '#e5e7eb',
  titleSize: 44,
  subtitleSize: 18,
  align: 'left',
  buttonText: 'Menüyü Gör',
  buttonLink: ''
}

const DEFAULT_CONTACT = {
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  mapUrl: '',
  instagram: '',
  facebook: '',
  tiktok: ''
}

const DEFAULT_NAVIGATION = {
  storyLabel: 'Hikaye',
  menuLabel: 'Menu',
  contactLabel: 'Iletisim',
  qrButtonText: 'QR Menu',
  cartButtonText: 'Sepet',
  onlineButtonText: 'Online Siparis'
}

const DEFAULT_INTEGRATIONS = {
  showQrMenu: true,
  qrMenuUrl: '',
  showProducts: true,
  showOnlineOrder: false,
  onlineOrderUrl: ''
}

const DEFAULT_SEO = {
  title: '',
  description: ''
}

const DEFAULT_SECTIONS = [
  { id: 'hero-1', type: 'hero', title: 'Kapak Alanı', subtitle: '', content: '', visible: true, order: 1, settings: {} },
  { id: 'products-1', type: 'products', title: 'Menü / Ürünler', subtitle: 'Ürünlerinizi müşterilerinize gösterin.', content: '', visible: true, order: 2, settings: { categoryMode: 'all', cardStyle: 'grid' } },
  { id: 'about-1', type: 'about', title: 'Hakkımızda', subtitle: '', content: 'İşletmeniz hakkında kısa bir açıklama paylaşın.', visible: true, order: 3, settings: { imageUrl: '', align: 'left' } },
  { id: 'contact-1', type: 'contact', title: 'İletişim', subtitle: '', content: '', visible: true, order: 4, settings: {} }
]

const STORE_SAMPLE_COPY = {
  heroTitle: 'Yeni sezon urunlerini tek vitrinde sergileyin',
  heroSubtitle: 'Kampanyalarinizi, cok satan urunlerinizi ve online siparis akisinizi sade bir magaza sayfasinda toplayin.',
  heroButtonText: 'Online Siparisi Ac',
  navigation: {
    storyLabel: 'Koleksiyon',
    menuLabel: 'Urunler',
    contactLabel: 'Teslimat',
    onlineButtonText: 'Online Siparis'
  },
  sections: [
    { id: 'hero-1', type: 'hero', title: 'Kapak Alani', subtitle: '', content: '', visible: true, order: 1, settings: {} },
    {
      id: 'products-1',
      type: 'products',
      title: 'One Cikan Urunler',
      subtitle: 'En cok ilgi goren urunleri vitrinde one cikarip musteriye hizli secim alani sunun.',
      content: '',
      visible: true,
      order: 2,
      settings: {
        categoryMode: 'all',
        cardStyle: 'grid',
        galleryLabel: 'Detaylar',
        galleryTitle: 'Urun ve paket fotograflari',
        galleryDescription: 'Magaza atmosferini, paket detaylarini ve kampanya gorsellerini burada sergileyin.',
        emptyStateText: 'Henuz vitrine eklenmis urun yok.',
        productFallbackDescription: 'Kisa urun aciklamasi burada gorunur.',
        imageFallbackText: 'Urun Gorseli'
      }
    },
    {
      id: 'about-1',
      type: 'about',
      title: 'Magazamiz',
      subtitle: 'Gunluk ihtiyac, ozel secki ve hizli teslimat tek yerde.',
      content: 'Mahallenin sevdigi urunleri ozenle secip temiz, hizli ve guvenilir bir alisveris deneyimi sunuyoruz.',
      visible: true,
      order: 3,
      settings: {
        imageUrl: '',
        align: 'left',
        manifestoLabel: '01 / Vitrin',
        manifestoText: 'Dogru urun, temiz sunum ve hizli teslimat iyi magaza deneyiminin temelidir.',
        sectionLabel: '02 / Magaza'
      }
    },
    {
      id: 'contact-1',
      type: 'contact',
      title: 'Siparis ve Teslimat',
      subtitle: 'Teslimat bolgesi, iletisim ve siparis notlari tek alanda.',
      content: '',
      visible: true,
      order: 4,
      settings: {
        addressLabel: 'Teslimat Bolgesi',
        reservationLabel: 'Siparis Hatti',
        quoteText: 'Hizli siparis, temiz paketleme ve guven veren teslimat.',
        quoteAuthor: 'Store Service Standard',
        emptyAddressText: 'Teslimat bolgesi bilgisi eklenmedi',
        emptyReservationText: 'Siparis hatti bilgisi eklenmedi',
        mapLinkText: 'Konumu Ac'
      }
    }
  ]
}

const PLATFORM_ROOT_HOSTS = new Set(['penpos.cloud', 'www.penpos.cloud'])

const normalizeString = (value, fallback = '') => String(value ?? fallback).trim()
const normalizeBoolean = (value, fallback = false) => value === undefined ? fallback : !!value
const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const normalizeTenantWebsiteSlug = (value, fallback = 'isletme') => {
  const normalized = String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return normalized || fallback
}

const normalizeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const isCanteenWebsiteSystem = (systemType) => {
  const normalized = String(systemType || '').trim().toLocaleLowerCase('tr-TR')
  return normalized === 'canteen' || normalized === 'kantin'
}

const isStoreSiteType = (siteType) => {
  const requested = String(siteType || '').trim().toLocaleLowerCase('tr-TR')
  return requested === 'store' || requested === 'magaza' || requested === 'wepmagaza'
}

const getTenantContextForSiteType = (tenant, siteType = '') => ({
  ...(tenant || {}),
  systemType: isStoreSiteType(siteType) ? 'kantin' : 'kermes'
})

const pickWebsiteSettingsForSiteType = (doc, tenant, siteType = '') => {
  const tenantContext = getTenantContextForSiteType(tenant, siteType)
  if (isStoreSiteType(siteType)) {
    return normalizeTenantWebsiteSettings(normalizeObject(doc?.storeVariant), tenantContext)
  }
  return normalizeTenantWebsiteSettings(doc || {}, tenantContext)
}

const buildDefaultTenantWebsiteSettings = (tenant = {}) => {
  const tenantName = normalizeString(tenant?.name, 'İşletmeniz')
  const tenantSlug = normalizeTenantWebsiteSlug(tenant?.slug || tenantName)
  const systemType = String(tenant?.systemType || 'kermes').trim()
  const isCanteen = isCanteenWebsiteSystem(systemType)
  return {
    tenantId: tenant?._id ? String(tenant._id) : '',
    enabled: true,
    published: false,
    slug: tenantSlug,
    theme: { ...DEFAULT_THEME },
    layout: { ...DEFAULT_LAYOUT },
    navigation: { ...DEFAULT_NAVIGATION, ...(isCanteen ? STORE_SAMPLE_COPY.navigation : {}) },
    hero: {
      ...DEFAULT_HERO,
      title: isCanteen ? STORE_SAMPLE_COPY.heroTitle : DEFAULT_HERO.title,
      subtitle: isCanteen ? STORE_SAMPLE_COPY.heroSubtitle : DEFAULT_HERO.subtitle,
      buttonText: isCanteen ? STORE_SAMPLE_COPY.heroButtonText : DEFAULT_HERO.buttonText,
      kickerText: isCanteen ? `Magaza · Market · ${tenantName}` : `Cafe · Restoran · ${tenantName}`,
      logoUrl: normalizeString(tenant?.logoUrl),
      galleryImages: [],
      buttonLink: isCanteen ? `/qr/${tenantSlug}` : `/menu/${tenantSlug}`
    },
    sections: (isCanteen ? STORE_SAMPLE_COPY.sections : DEFAULT_SECTIONS).map((section) => ({ ...section, settings: { ...(section.settings || {}) } })),
    contact: {
      ...DEFAULT_CONTACT,
      phone: normalizeString(tenant?.phone),
      address: normalizeString(tenant?.description)
    },
    integrations: {
      ...DEFAULT_INTEGRATIONS,
      showQrMenu: isCanteen ? false : DEFAULT_INTEGRATIONS.showQrMenu,
      showOnlineOrder: isCanteen ? true : DEFAULT_INTEGRATIONS.showOnlineOrder,
      qrMenuUrl: isCanteen ? '' : `/menu/${tenantSlug}`,
      onlineOrderUrl: isCanteen ? `/qr/${tenantSlug}` : DEFAULT_INTEGRATIONS.onlineOrderUrl
    },
    seo: {
      ...DEFAULT_SEO,
      title: tenantName,
      description: 'PenPOS web sitesi'
    }
  }
}

export const normalizeTenantWebsiteSettings = (input = {}, tenant = {}) => {
  const defaults = buildDefaultTenantWebsiteSettings(tenant)
  const source = { ...defaults, ...normalizeObject(input) }
  const galleryImages = Array.isArray(source?.hero?.galleryImages)
    ? source.hero.galleryImages
      .map((item, index) => {
        if (typeof item === 'string') {
          const url = normalizeString(item)
          return url ? { id: `gallery-${index + 1}`, url } : null
        }
        const url = normalizeString(item?.url)
        if (!url) return null
        return {
          id: normalizeString(item?.id, `gallery-${index + 1}`),
          url
        }
      })
      .filter(Boolean)
    : defaults.hero.galleryImages
  return {
    tenantId: defaults.tenantId,
    enabled: normalizeBoolean(source.enabled, defaults.enabled),
    published: normalizeBoolean(source.published, defaults.published),
    slug: normalizeTenantWebsiteSlug(source.slug || defaults.slug),
    theme: {
      backgroundColor: normalizeString(source?.theme?.backgroundColor, defaults.theme.backgroundColor),
      textColor: normalizeString(source?.theme?.textColor, defaults.theme.textColor),
      primaryColor: normalizeString(source?.theme?.primaryColor, defaults.theme.primaryColor),
      secondaryColor: normalizeString(source?.theme?.secondaryColor, defaults.theme.secondaryColor),
      buttonColor: normalizeString(source?.theme?.buttonColor, defaults.theme.buttonColor),
      buttonTextColor: normalizeString(source?.theme?.buttonTextColor, defaults.theme.buttonTextColor),
      cardColor: normalizeString(source?.theme?.cardColor, defaults.theme.cardColor),
      borderRadius: normalizeNumber(source?.theme?.borderRadius, defaults.theme.borderRadius),
      fontFamily: normalizeString(source?.theme?.fontFamily, defaults.theme.fontFamily)
    },
    layout: {
      maxWidth: normalizeString(source?.layout?.maxWidth, defaults.layout.maxWidth),
      headerStyle: normalizeString(source?.layout?.headerStyle, defaults.layout.headerStyle),
      sectionSpacing: normalizeNumber(source?.layout?.sectionSpacing, defaults.layout.sectionSpacing),
      contentAlign: normalizeString(source?.layout?.contentAlign, defaults.layout.contentAlign)
    },
    navigation: {
      storyLabel: normalizeString(source?.navigation?.storyLabel, defaults.navigation.storyLabel),
      menuLabel: normalizeString(source?.navigation?.menuLabel, defaults.navigation.menuLabel),
      contactLabel: normalizeString(source?.navigation?.contactLabel, defaults.navigation.contactLabel),
      qrButtonText: normalizeString(source?.navigation?.qrButtonText, defaults.navigation.qrButtonText),
      cartButtonText: normalizeString(source?.navigation?.cartButtonText, defaults.navigation.cartButtonText),
      onlineButtonText: normalizeString(source?.navigation?.onlineButtonText, defaults.navigation.onlineButtonText)
    },
    hero: {
      visible: normalizeBoolean(source?.hero?.visible, defaults.hero.visible),
      title: normalizeString(source?.hero?.title, defaults.hero.title),
      subtitle: normalizeString(source?.hero?.subtitle, defaults.hero.subtitle),
      kickerText: normalizeString(source?.hero?.kickerText, defaults.hero.kickerText),
      logoUrl: normalizeString(source?.hero?.logoUrl, defaults.hero.logoUrl),
      coverImageUrl: normalizeString(source?.hero?.coverImageUrl, defaults.hero.coverImageUrl),
      galleryImages,
      backgroundColor: normalizeString(source?.hero?.backgroundColor, defaults.hero.backgroundColor),
      titleSize: normalizeNumber(source?.hero?.titleSize, defaults.hero.titleSize),
      subtitleSize: normalizeNumber(source?.hero?.subtitleSize, defaults.hero.subtitleSize),
      align: normalizeString(source?.hero?.align, defaults.hero.align),
      buttonText: normalizeString(source?.hero?.buttonText, defaults.hero.buttonText),
      buttonLink: normalizeString(source?.hero?.buttonLink, defaults.hero.buttonLink)
    },
    sections: (Array.isArray(source.sections) ? source.sections : defaults.sections)
      .map((item, index) => {
        const type = SECTION_TYPES.includes(String(item?.type || '').trim()) ? String(item.type).trim() : 'customText'
        return {
          id: normalizeString(item?.id, `${type}-${index + 1}`),
          type,
          title: normalizeString(item?.title),
          subtitle: normalizeString(item?.subtitle),
          content: normalizeString(item?.content),
          visible: normalizeBoolean(item?.visible, true),
          order: normalizeNumber(item?.order, index + 1),
          settings: normalizeObject(item?.settings)
        }
      })
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0)),
    contact: {
      phone: normalizeString(source?.contact?.phone, defaults.contact.phone),
      whatsapp: normalizeString(source?.contact?.whatsapp, defaults.contact.whatsapp),
      email: normalizeString(source?.contact?.email, defaults.contact.email),
      address: normalizeString(source?.contact?.address, defaults.contact.address),
      mapUrl: normalizeString(source?.contact?.mapUrl, defaults.contact.mapUrl),
      instagram: normalizeString(source?.contact?.instagram, defaults.contact.instagram),
      facebook: normalizeString(source?.contact?.facebook, defaults.contact.facebook),
      tiktok: normalizeString(source?.contact?.tiktok, defaults.contact.tiktok)
    },
    integrations: {
      showQrMenu: normalizeBoolean(source?.integrations?.showQrMenu, defaults.integrations.showQrMenu),
      qrMenuUrl: normalizeString(source?.integrations?.qrMenuUrl, defaults.integrations.qrMenuUrl),
      showProducts: normalizeBoolean(source?.integrations?.showProducts, defaults.integrations.showProducts),
      showOnlineOrder: normalizeBoolean(source?.integrations?.showOnlineOrder, defaults.integrations.showOnlineOrder),
      onlineOrderUrl: normalizeString(source?.integrations?.onlineOrderUrl, defaults.integrations.onlineOrderUrl)
    },
    seo: {
      title: normalizeString(source?.seo?.title, defaults.seo.title),
      description: normalizeString(source?.seo?.description, defaults.seo.description)
    }
  }
}

const ensureTenant = async (tenantId) => {
  if (!mongoose.Types.ObjectId.isValid(String(tenantId || ''))) throw error('invalid_request', 'Tenant not found', 404)
  const tenant = await Tenant.findById(tenantId).lean()
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  return tenant
}

const getOrCreateTenantWebsiteDoc = async (tenantId, siteType = '') => {
  const tenant = await ensureTenant(tenantId)
  let doc = await TenantWebsiteSettings.findOne({ tenantId: tenant._id }).lean()
  if (!doc) {
    const created = await TenantWebsiteSettings.create(normalizeTenantWebsiteSettings({}, getTenantContextForSiteType(tenant, 'restaurant')))
    doc = created?.toObject ? created.toObject() : created
  }
  const normalized = pickWebsiteSettingsForSiteType(doc || {}, tenant, siteType)
  if (!isStoreSiteType(siteType) && (String(doc?.slug || '') !== normalized.slug || JSON.stringify(doc?.sections || []) !== JSON.stringify(normalized.sections || []))) {
    await TenantWebsiteSettings.updateOne({ tenantId: tenant._id }, { $set: normalized })
  }
  return { tenant, settings: { ...normalized, updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

const ensureSlugAvailable = async (slug, tenantId, siteType = '') => {
  const normalizedSlug = normalizeTenantWebsiteSlug(slug)
  const existingQuery = isStoreSiteType(siteType)
    ? { 'storeVariant.slug': normalizedSlug, tenantId: { $ne: tenantId } }
    : { slug: normalizedSlug, tenantId: { $ne: tenantId } }
  const existing = await TenantWebsiteSettings.findOne(existingQuery).select('_id tenantId slug storeVariant').lean()
  if (existing) {
    throw error('slug_in_use', 'Bu site adresi başka bir işletme tarafından kullanılıyor.', 409)
  }
  return normalizedSlug
}

const toRestaurantProducts = async (tenant) => {
  const [categories, items] = await Promise.all([
    Category.find(notDeletedFilter({ tenantId: tenant._id, isActive: true })).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItem.find(notDeletedFilter({ tenantId: tenant._id, isActive: true })).sort({ sortOrder: 1, name: 1 }).lean()
  ])
  const visibleCategories = (Array.isArray(categories) ? categories : []).map((category) => ({
    id: String(category._id),
    name: String(category.name || ''),
    sortOrder: Number(category.sortOrder || 0)
  }))
  const categoryMap = new Map(visibleCategories.map((category) => [category.id, category]))
  const visibleItems = (Array.isArray(items) ? items : []).map((item) => {
    const rawCategoryId = String(item?.categoryId || '')
    const hasCategory = categoryMap.has(rawCategoryId)
    return {
      id: String(item._id),
      categoryId: hasCategory ? rawCategoryId : 'uncategorized',
      categoryName: categoryMap.get(rawCategoryId)?.name || 'Diger Urunler',
      name: String(item.name || ''),
      description: String(item.description || ''),
      imageUrl: String(item.imageUrl || ''),
      price: Number(item.price || 0),
      sortOrder: Number(item.sortOrder || 0)
    }
  })
  const categoriesOut = [...visibleCategories]
  if (visibleItems.some((item) => item.categoryId === 'uncategorized')) {
    categoriesOut.push({ id: 'uncategorized', name: 'Diger Urunler', sortOrder: 9999 })
  }
  return { categories: categoriesOut, items: visibleItems }
}

const toCanteenProducts = async (tenant) => {
  const settings = await CanteenTenantSettings.findOne({ tenantId: tenant._id }).lean()
  const mergedBusinessSettings = mergeBusinessSettings(tenant?.settings || {})
  const branches = await CanteenBranch.find({ tenantId: tenant._id, isActive: true }).sort({ createdAt: -1 }).lean()
  const activeBranchIds = (branches || []).map((branch) => String(branch._id))
  const allowedBranchIdsRaw = Array.isArray(settings?.canteenAllowedBranchIds)
    ? settings.canteenAllowedBranchIds.map(String).filter(Boolean)
    : []
  const preferredBranchId = String(mergedBusinessSettings?.onlineSales?.branchId || '').trim()
  const branchPool = (allowedBranchIdsRaw.length > 0 ? allowedBranchIdsRaw : activeBranchIds).filter((branchId) => activeBranchIds.includes(branchId))
  const allowedBranchIds = preferredBranchId && branchPool.includes(preferredBranchId) ? [preferredBranchId] : branchPool
  const [products, categories] = await Promise.all([
    CanteenProduct.find({ tenantId: tenant._id, branchId: { $in: allowedBranchIds }, isActive: true }).sort({ nameNormalized: 1, name: 1 }).lean(),
    CanteenCategory.find({ tenantId: tenant._id, branchId: { $in: allowedBranchIds }, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean()
  ])
  const categoryMap = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [
      String(category._id),
      {
        id: String(category._id),
        name: String(category.name || ''),
        sortOrder: Number(category.sortOrder || 0)
      }
    ])
  )
  const visibleItems = (Array.isArray(products) ? products : []).map((product) => ({
    id: String(product._id),
    categoryId: categoryMap.has(String(product.categoryId || '')) ? String(product.categoryId || '') : 'uncategorized',
    categoryName: categoryMap.get(String(product.categoryId || ''))?.name || 'Diğer Ürünler',
    name: String(product.name || ''),
    description: '',
    imageUrl: String(product.imageUrl || ''),
    price: Number(product.price || 0),
    sortOrder: 0
  }))
  const categoriesOut = Array.from(categoryMap.values())
  if (visibleItems.some((item) => item.categoryId === 'uncategorized')) {
    categoriesOut.push({ id: 'uncategorized', name: 'Diğer Ürünler', sortOrder: 9999 })
  }
  return { categories: categoriesOut, items: visibleItems }
}

const buildTenantPublicSitePayload = async (tenant, settings, siteType = '') => {
  const tenantContext = getTenantContextForSiteType(tenant, siteType)
  const normalized = normalizeTenantWebsiteSettings(settings || {}, tenantContext)
  const productData = normalized.integrations.showProducts
    ? (isStoreSiteType(siteType) ? await toCanteenProducts(tenant) : await toRestaurantProducts(tenant))
    : { categories: [], items: [] }
  return {
    kind: 'tenant',
    tenant: {
      id: String(tenant._id),
      name: String(tenant.name || ''),
      slug: String(tenant.slug || ''),
      systemType: String(tenantContext.systemType || tenant.systemType || 'kermes'),
      logoUrl: String(tenant.logoUrl || '')
    },
    settings: normalized,
    data: productData
  }
}

const parseHost = (hostValue) => String(hostValue || '').trim().toLocaleLowerCase('en-US').replace(/:\d+$/, '')

export const getTenantWebsiteSettingsService = async (tenantId, siteType = '') => {
  return getOrCreateTenantWebsiteDoc(tenantId, siteType)
}

export const updateTenantWebsiteSettingsService = async ({ tenantId, actorUserId, payload = {}, siteType = '' }) => {
  const tenant = await ensureTenant(tenantId)
  const current = await TenantWebsiteSettings.findOne({ tenantId: tenant._id }).lean()
  const tenantContext = getTenantContextForSiteType(tenant, siteType)
  const currentVariant = isStoreSiteType(siteType) ? normalizeObject(current?.storeVariant) : (current || {})
  const next = normalizeTenantWebsiteSettings({ ...currentVariant, ...normalizeObject(payload) }, tenantContext)
  next.slug = await ensureSlugAvailable(next.slug, tenant._id, siteType)
  const updateDoc = isStoreSiteType(siteType)
    ? {
        $set: {
          tenantId: tenant._id,
          storeVariant: next,
          updatedBy: actorUserId || null
        }
      }
    : {
        $set: {
          ...next,
          tenantId: tenant._id,
          updatedBy: actorUserId || null
        }
      }
  const doc = await TenantWebsiteSettings.findOneAndUpdate(
    { tenantId: tenant._id },
    updateDoc,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  const savedSettings = pickWebsiteSettingsForSiteType(doc || {}, tenant, siteType)
  return { tenant, settings: { ...savedSettings, updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const publishTenantWebsiteService = async ({ tenantId, actorUserId, siteType = '' }) => {
  const { tenant, settings } = await getOrCreateTenantWebsiteDoc(tenantId, siteType)
  const slug = await ensureSlugAvailable(settings.slug, tenant._id, siteType)
  const next = { ...settings, published: true, enabled: true, slug }
  const updateDoc = isStoreSiteType(siteType)
    ? {
        $set: {
          storeVariant: next,
          updatedBy: actorUserId || null,
          publishedAt: new Date()
        }
      }
    : {
        $set: {
          published: true,
          enabled: true,
          slug,
          updatedBy: actorUserId || null,
          publishedAt: new Date()
        }
      }
  const doc = await TenantWebsiteSettings.findOneAndUpdate({ tenantId: tenant._id }, updateDoc, { new: true }).lean()
  const savedSettings = pickWebsiteSettingsForSiteType(doc || {}, tenant, siteType)
  return { tenant, settings: { ...savedSettings, updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const unpublishTenantWebsiteService = async ({ tenantId, actorUserId, siteType = '' }) => {
  const { tenant, settings } = await getOrCreateTenantWebsiteDoc(tenantId, siteType)
  const next = { ...settings, published: false, enabled: false }
  const updateDoc = isStoreSiteType(siteType)
    ? {
        $set: {
          storeVariant: next,
          updatedBy: actorUserId || null
        }
      }
    : {
        $set: {
          published: false,
          enabled: false,
          updatedBy: actorUserId || null
        }
      }
  const doc = await TenantWebsiteSettings.findOneAndUpdate({ tenantId: tenant._id }, updateDoc, { new: true }).lean()
  const savedSettings = pickWebsiteSettingsForSiteType(doc || {}, tenant, siteType)
  return { tenant, settings: { ...savedSettings, updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const getPublicTenantWebsiteBySlugService = async (slug, siteType = '') => {
  const normalizedSlug = normalizeTenantWebsiteSlug(slug)
  const doc = isStoreSiteType(siteType)
    ? await TenantWebsiteSettings.findOne({ 'storeVariant.slug': normalizedSlug }).lean()
    : await TenantWebsiteSettings.findOne({ slug: normalizedSlug }).lean()
  if (!doc) throw error('not_found', 'Bu web sitesi bulunamadı.', 404)
  const tenant = await Tenant.findOne({ _id: doc.tenantId, isActive: true, status: 'active' }).lean()
  if (!tenant) throw error('not_found', 'Bu web sitesi bulunamadı.', 404)
  const normalized = pickWebsiteSettingsForSiteType(doc || {}, tenant, siteType)
  if (!normalized.enabled || !normalized.published) {
    throw error('site_unpublished', 'Bu web sitesi henüz yayında değil.', 404)
  }
  return buildTenantPublicSitePayload(tenant, normalized, siteType)
}

export const getPublicWebsiteByHostService = async (hostValue) => {
  const host = parseHost(hostValue)
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return { kind: 'platform', settings: normalizeWebsiteSettings(await WebsiteSettings.findOne({ key: 'primary' }).lean() || getDefaultWebsiteSettings()) }
  }
  if (PLATFORM_ROOT_HOSTS.has(host) || !host.endsWith('.penpos.cloud')) {
    return { kind: 'platform', settings: normalizeWebsiteSettings(await WebsiteSettings.findOne({ key: 'primary' }).lean() || getDefaultWebsiteSettings()) }
  }
  const slug = host.replace(/\.penpos\.cloud$/, '')
  return getPublicTenantWebsiteBySlugService(slug)
}
