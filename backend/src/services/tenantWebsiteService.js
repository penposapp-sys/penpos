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
import { notDeletedFilter } from '../utils/softDelete.js'
import { getDefaultWebsiteSettings, normalizeWebsiteSettings } from './websiteSettingsService.js'

const SECTION_TYPES = ['hero', 'products', 'about', 'contact', 'map', 'social', 'buttons', 'qrMenu', 'onlineOrder', 'customText']

const DEFAULT_THEME = {
  backgroundColor: '#0f172a',
  textColor: '#ffffff',
  primaryColor: '#d9b56f',
  secondaryColor: '#1f2937',
  buttonColor: '#d9b56f',
  buttonTextColor: '#111827',
  cardColor: 'rgba(255,255,255,0.08)',
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
  logoUrl: '',
  coverImageUrl: '',
  backgroundColor: '#0f172a',
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

const buildDefaultTenantWebsiteSettings = (tenant = {}) => {
  const tenantName = normalizeString(tenant?.name, 'İşletmeniz')
  const tenantSlug = normalizeTenantWebsiteSlug(tenant?.slug || tenantName)
  const systemType = String(tenant?.systemType || 'kermes').trim()
  return {
    tenantId: tenant?._id ? String(tenant._id) : '',
    enabled: true,
    published: false,
    slug: tenantSlug,
    theme: { ...DEFAULT_THEME },
    layout: { ...DEFAULT_LAYOUT },
    hero: {
      ...DEFAULT_HERO,
      logoUrl: normalizeString(tenant?.logoUrl),
      buttonLink: systemType === 'kantin' ? `/qr/${tenantSlug}` : `/menu/${tenantSlug}`
    },
    sections: DEFAULT_SECTIONS.map((section) => ({ ...section, settings: { ...(section.settings || {}) } })),
    contact: {
      ...DEFAULT_CONTACT,
      phone: normalizeString(tenant?.phone),
      address: normalizeString(tenant?.description)
    },
    integrations: {
      ...DEFAULT_INTEGRATIONS,
      qrMenuUrl: systemType === 'kantin' ? `/qr/${tenantSlug}` : `/menu/${tenantSlug}`
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
    hero: {
      visible: normalizeBoolean(source?.hero?.visible, defaults.hero.visible),
      title: normalizeString(source?.hero?.title, defaults.hero.title),
      subtitle: normalizeString(source?.hero?.subtitle, defaults.hero.subtitle),
      logoUrl: normalizeString(source?.hero?.logoUrl, defaults.hero.logoUrl),
      coverImageUrl: normalizeString(source?.hero?.coverImageUrl, defaults.hero.coverImageUrl),
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

const getOrCreateTenantWebsiteDoc = async (tenantId) => {
  const tenant = await ensureTenant(tenantId)
  let doc = await TenantWebsiteSettings.findOne({ tenantId: tenant._id }).lean()
  if (!doc) {
    const created = await TenantWebsiteSettings.create(normalizeTenantWebsiteSettings({}, tenant))
    doc = created?.toObject ? created.toObject() : created
  }
  const normalized = normalizeTenantWebsiteSettings(doc || {}, tenant)
  if (String(doc?.slug || '') !== normalized.slug || JSON.stringify(doc?.sections || []) !== JSON.stringify(normalized.sections || [])) {
    await TenantWebsiteSettings.updateOne({ tenantId: tenant._id }, { $set: normalized })
  }
  return { tenant, settings: { ...normalized, updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

const ensureSlugAvailable = async (slug, tenantId) => {
  const normalizedSlug = normalizeTenantWebsiteSlug(slug)
  const existing = await TenantWebsiteSettings.findOne({ slug: normalizedSlug, tenantId: { $ne: tenantId } }).select('_id tenantId slug').lean()
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
  const visibleItems = (Array.isArray(items) ? items : []).filter((item) => categoryMap.has(String(item?.categoryId || ''))).map((item) => ({
    id: String(item._id),
    categoryId: String(item.categoryId || ''),
    categoryName: categoryMap.get(String(item.categoryId || ''))?.name || '',
    name: String(item.name || ''),
    description: String(item.description || ''),
    imageUrl: String(item.imageUrl || ''),
    price: Number(item.price || 0),
    sortOrder: Number(item.sortOrder || 0)
  }))
  return { categories: visibleCategories, items: visibleItems }
}

const toCanteenProducts = async (tenant) => {
  const settings = await CanteenTenantSettings.findOne({ tenantId: tenant._id }).lean()
  const branches = await CanteenBranch.find({ tenantId: tenant._id, isActive: true }).sort({ createdAt: -1 }).lean()
  const activeBranchIds = (branches || []).map((branch) => String(branch._id))
  const allowedBranchIdsRaw = Array.isArray(settings?.canteenAllowedBranchIds)
    ? settings.canteenAllowedBranchIds.map(String).filter(Boolean)
    : []
  const allowedBranchIds = (allowedBranchIdsRaw.length > 0 ? allowedBranchIdsRaw : activeBranchIds).filter((branchId) => activeBranchIds.includes(branchId))
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

const buildTenantPublicSitePayload = async (tenant, settings) => {
  const normalized = normalizeTenantWebsiteSettings(settings || {}, tenant)
  const productData = normalized.integrations.showProducts
    ? ((tenant.systemType || 'kermes') === 'kantin' ? await toCanteenProducts(tenant) : await toRestaurantProducts(tenant))
    : { categories: [], items: [] }
  return {
    kind: 'tenant',
    tenant: {
      id: String(tenant._id),
      name: String(tenant.name || ''),
      slug: String(tenant.slug || ''),
      systemType: String(tenant.systemType || 'kermes'),
      logoUrl: String(tenant.logoUrl || '')
    },
    settings: normalized,
    data: productData
  }
}

const parseHost = (hostValue) => String(hostValue || '').trim().toLocaleLowerCase('en-US').replace(/:\d+$/, '')

export const getTenantWebsiteSettingsService = async (tenantId) => {
  return getOrCreateTenantWebsiteDoc(tenantId)
}

export const updateTenantWebsiteSettingsService = async ({ tenantId, actorUserId, payload = {} }) => {
  const tenant = await ensureTenant(tenantId)
  const current = await TenantWebsiteSettings.findOne({ tenantId: tenant._id }).lean()
  const next = normalizeTenantWebsiteSettings({ ...(current || {}), ...normalizeObject(payload) }, tenant)
  next.slug = await ensureSlugAvailable(next.slug, tenant._id)
  const doc = await TenantWebsiteSettings.findOneAndUpdate(
    { tenantId: tenant._id },
    {
      $set: {
        ...next,
        tenantId: tenant._id,
        updatedBy: actorUserId || null
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  return { tenant, settings: { ...normalizeTenantWebsiteSettings(doc || {}, tenant), updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const publishTenantWebsiteService = async ({ tenantId, actorUserId }) => {
  const { tenant, settings } = await getOrCreateTenantWebsiteDoc(tenantId)
  const slug = await ensureSlugAvailable(settings.slug, tenant._id)
  const doc = await TenantWebsiteSettings.findOneAndUpdate(
    { tenantId: tenant._id },
    {
      $set: {
        published: true,
        enabled: true,
        slug,
        updatedBy: actorUserId || null,
        publishedAt: new Date()
      }
    },
    { new: true }
  ).lean()
  return { tenant, settings: { ...normalizeTenantWebsiteSettings(doc || {}, tenant), updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const unpublishTenantWebsiteService = async ({ tenantId, actorUserId }) => {
  const { tenant } = await getOrCreateTenantWebsiteDoc(tenantId)
  const doc = await TenantWebsiteSettings.findOneAndUpdate(
    { tenantId: tenant._id },
    {
      $set: {
        published: false,
        updatedBy: actorUserId || null
      }
    },
    { new: true }
  ).lean()
  return { tenant, settings: { ...normalizeTenantWebsiteSettings(doc || {}, tenant), updatedAt: doc?.updatedAt || null, publishedAt: doc?.publishedAt || null } }
}

export const getPublicTenantWebsiteBySlugService = async (slug) => {
  const normalizedSlug = normalizeTenantWebsiteSlug(slug)
  const doc = await TenantWebsiteSettings.findOne({ slug: normalizedSlug }).lean()
  if (!doc) throw error('not_found', 'Bu web sitesi bulunamadı.', 404)
  const tenant = await Tenant.findOne({ _id: doc.tenantId, isActive: true, status: 'active' }).lean()
  if (!tenant) throw error('not_found', 'Bu web sitesi bulunamadı.', 404)
  const normalized = normalizeTenantWebsiteSettings(doc || {}, tenant)
  if (!normalized.enabled || !normalized.published) {
    throw error('site_unpublished', 'Bu web sitesi henüz yayında değil.', 404)
  }
  return buildTenantPublicSitePayload(tenant, normalized)
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
