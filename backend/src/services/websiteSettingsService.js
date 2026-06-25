import WebsiteSettings from '../models/WebsiteSettings.js'
import { error } from '../utils/errors.js'

const withId = (prefix, index, value = {}) => ({
  ...value,
  id: String(value?.id || `${prefix}-${index + 1}`)
})

const INTERNAL_PATH_PATTERN = /^\/(?!\/)[^\s]*$/

export const getDefaultWebsiteSettings = () => ({
  siteTitle: 'PenPOS',
  siteDescription: 'Restoran, cafe, kantin ve marketler icin ayri akisli modern bulut otomasyon sistemi.',
  heroTitle: 'Restoran ve kantin sistemlerini ayri ayri yonetin.',
  heroSubtitle: 'YENI NESIL SATIS VE ADISYON YONETIMI',
  heroDescription: 'PenPOS; restoran-cafe ve kantin-market icin ayri girisleri, ayri ekran akislari olan modern otomasyon yapisidir. Restoran tarafinda QR menu standart olarak dahildir; her isletme istedigi kadar sube acabilir.',
  trialDays: 7,
  primaryCtaText: '1 Haftalik Ucretsiz Deneme',
  primaryCtaUrl: '/register',
  secondaryCtaText: 'Giris Yap',
  secondaryCtaUrl: '/login/restoran',
  restaurantLoginText: 'Restoran Girisi',
  restaurantLoginUrl: '/login/restoran',
  canteenLoginText: 'Kantin Girisi',
  canteenLoginUrl: '/canteen/login',
  platformLoginText: 'Platform Girisi',
  platformLoginUrl: '/platform/login',
  marketLoginUrl: '/canteen/login',
  registerUrl: '/register',
  whatsappUrl: 'https://wa.me/905313375562',
  phone: '0531 337 55 62',
  email: 'penpos.app@gmail.com',
  address: '',
  androidButtonText: 'Android Uygulamasini Indir',
  androidApkUrl: 'https://drive.google.com/uc?id=1_QZs8wYc0mtVSfPtBllJIXt5r-e9M9iv&export=download',
  androidButtonActive: true,
  footerText: '© 2026 PenPOS. Restoran, magaza ve market otomasyon sistemi.',
  socialInstagramUrl: '',
  socialFacebookUrl: '',
  socialXUrl: '',
  socialYoutubeUrl: '',
  socialLinkedinUrl: '',
  features: [
    { id: 'feature-1', icon: 'store', title: 'Restoran / Cafe', text: 'Masa, adisyon, mutfak, paket servis, kurye ve QR menu akislari restoran tarafinda birlikte calisir.', sortOrder: 1, active: true },
    { id: 'feature-2', icon: 'cart', title: 'Kantin / Market', text: 'Barkodlu hizli satis, urun fiyat listesi, stok ve online satis mantigi kantin tarafina uyarlanir.', sortOrder: 2, active: true },
    { id: 'feature-3', icon: 'chart', title: 'Canli Raporlar', text: 'Z raporu, odeme tipleri, sube filtreleri ve cari bakiye gibi veriler tek panelde izlenir.', sortOrder: 3, active: true }
  ],
  systemCards: [],
  pricingPlans: [],
  trainingVideos: [
    { id: 'video-1', title: 'Uyelik ve Ilk Kurulum', description: 'Ilk hesap acilisi ve panel tanitimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 1 },
    { id: 'video-2', title: 'Restoran Satis Akisi', description: 'Masa ve adisyon akisinin temel kullanimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'restaurant', active: true, sortOrder: 2 },
    { id: 'video-3', title: 'Kantin Barkodlu Satis', description: 'Hizli kasa ve barkodlu satis ornegi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'market', active: true, sortOrder: 3 }
  ],
  integrations: [],
  seoTitle: 'PenPOS | Restoran ve Kantin Otomasyonu',
  seoDescription: 'PenPOS ile restoran/cafe ve kantin/market akislari ayri girislerle yonetilir. QR menu dahil, sinirsiz sube ve raporlama hazir.',
  seoKeywords: 'penpos,pos,restoran otomasyonu,kantin otomasyonu,market otomasyonu,qr menu',
  isPublished: true
})

const stripHtml = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const normalizeString = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback
  return stripHtml(value)
}
const normalizeBoolean = (value, fallback = false) => value === undefined ? fallback : !!value
const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const normalizeStringList = (list = []) => Array.isArray(list) ? list.map((item) => stripHtml(item)).filter(Boolean) : []

const normalizeLink = (value, options = {}) => {
  const {
    fallback = '',
    fieldLabel = 'Link',
    allowInternal = true,
    allowHttps = true,
    allowMailto = false,
    allowTel = false
  } = options

  const raw = stripHtml(value || fallback)
  if (!raw) return ''

  if (allowInternal && INTERNAL_PATH_PATTERN.test(raw)) return raw

  try {
    const url = new URL(raw)
    const allowedProtocols = new Set([
      ...(allowHttps ? ['https:'] : []),
      ...(allowMailto ? ['mailto:'] : []),
      ...(allowTel ? ['tel:'] : [])
    ])
    if (!allowedProtocols.has(url.protocol)) {
      throw error('invalid_link', `${fieldLabel} gecersiz`, 400)
    }
    return url.toString()
  } catch (err) {
    if (err?.payload?.error === 'invalid_link') throw err
    throw error('invalid_link', `${fieldLabel} gecersiz`, 400)
  }
}

export const normalizeWebsiteSettings = (input = {}) => {
  const defaults = getDefaultWebsiteSettings()
  const source = { ...defaults, ...(input || {}) }

  const restaurantLoginUrl = normalizeLink(source.restaurantLoginUrl, {
    fallback: defaults.restaurantLoginUrl,
    fieldLabel: 'Restoran giris linki'
  })
  const canteenLoginUrl = normalizeLink(source.canteenLoginUrl ?? source.marketLoginUrl, {
    fallback: defaults.canteenLoginUrl,
    fieldLabel: 'Kantin giris linki'
  })
  const platformLoginUrl = normalizeLink(source.platformLoginUrl, {
    fallback: defaults.platformLoginUrl,
    fieldLabel: 'Platform giris linki'
  })
  const primaryCtaUrl = normalizeLink(source.primaryCtaUrl ?? source.registerUrl, {
    fallback: defaults.primaryCtaUrl,
    fieldLabel: 'Ana buton linki'
  })
  const secondaryCtaUrl = normalizeLink(source.secondaryCtaUrl, {
    fallback: defaults.secondaryCtaUrl,
    fieldLabel: 'Ikinci buton linki'
  })

  return {
    siteTitle: normalizeString(source.siteTitle, defaults.siteTitle),
    siteDescription: normalizeString(source.siteDescription, defaults.siteDescription),
    heroTitle: normalizeString(source.heroTitle, defaults.heroTitle),
    heroSubtitle: normalizeString(source.heroSubtitle, defaults.heroSubtitle),
    heroDescription: normalizeString(source.heroDescription, defaults.heroDescription),
    trialDays: normalizeNumber(source.trialDays, defaults.trialDays),
    primaryCtaText: normalizeString(source.primaryCtaText, defaults.primaryCtaText),
    primaryCtaUrl,
    secondaryCtaText: normalizeString(source.secondaryCtaText, defaults.secondaryCtaText),
    secondaryCtaUrl,
    restaurantLoginText: normalizeString(source.restaurantLoginText, defaults.restaurantLoginText),
    restaurantLoginUrl,
    canteenLoginText: normalizeString(source.canteenLoginText, defaults.canteenLoginText),
    canteenLoginUrl,
    platformLoginText: normalizeString(source.platformLoginText, defaults.platformLoginText),
    platformLoginUrl,
    marketLoginUrl: canteenLoginUrl,
    registerUrl: normalizeLink(source.registerUrl ?? primaryCtaUrl, {
      fallback: defaults.registerUrl,
      fieldLabel: 'Kayit linki'
    }),
    whatsappUrl: normalizeLink(source.whatsappUrl, {
      fallback: defaults.whatsappUrl,
      fieldLabel: 'WhatsApp linki'
    }),
    phone: normalizeString(source.phone, defaults.phone),
    email: normalizeString(source.email, defaults.email),
    address: normalizeString(source.address, defaults.address),
    androidButtonText: normalizeString(source.androidButtonText, defaults.androidButtonText),
    androidApkUrl: normalizeLink(source.androidApkUrl, {
      fallback: defaults.androidApkUrl,
      fieldLabel: 'APK indirme linki'
    }),
    androidButtonActive: normalizeBoolean(source.androidButtonActive, defaults.androidButtonActive),
    footerText: normalizeString(source.footerText, defaults.footerText),
    socialInstagramUrl: normalizeLink(source.socialInstagramUrl, { fieldLabel: 'Instagram linki' }),
    socialFacebookUrl: normalizeLink(source.socialFacebookUrl, { fieldLabel: 'Facebook linki' }),
    socialXUrl: normalizeLink(source.socialXUrl, { fieldLabel: 'X linki' }),
    socialYoutubeUrl: normalizeLink(source.socialYoutubeUrl, { fieldLabel: 'YouTube linki' }),
    socialLinkedinUrl: normalizeLink(source.socialLinkedinUrl, { fieldLabel: 'LinkedIn linki' }),
    features: (Array.isArray(source.features) ? source.features : defaults.features).map((item, index) => ({
      id: normalizeString(withId('feature', index, item).id),
      icon: normalizeString(item?.icon),
      title: normalizeString(item?.title),
      text: normalizeString(item?.text),
      sortOrder: normalizeNumber(item?.sortOrder, index + 1),
      active: normalizeBoolean(item?.active, true)
    })),
    systemCards: (Array.isArray(source.systemCards) ? source.systemCards : defaults.systemCards).map((item, index) => ({
      id: normalizeString(withId('system', index, item).id),
      type: String(item?.type || '').trim() === 'market' ? 'market' : 'restaurant',
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
      bullets: normalizeStringList(item?.bullets),
      active: normalizeBoolean(item?.active, true)
    })),
    pricingPlans: (Array.isArray(source.pricingPlans) ? source.pricingPlans : defaults.pricingPlans).map((item, index) => ({
      id: normalizeString(withId('plan', index, item).id),
      name: normalizeString(item?.name),
      price: normalizeString(item?.price),
      period: normalizeString(item?.period),
      description: normalizeString(item?.description),
      items: normalizeStringList(item?.items),
      popular: normalizeBoolean(item?.popular, false),
      buttonText: normalizeString(item?.buttonText),
      buttonUrl: normalizeLink(item?.buttonUrl, { fieldLabel: `${item?.name || 'Paket'} buton linki` }),
      active: normalizeBoolean(item?.active, true),
      sortOrder: normalizeNumber(item?.sortOrder, index + 1)
    })),
    trainingVideos: (Array.isArray(source.trainingVideos) ? source.trainingVideos : defaults.trainingVideos).map((item, index) => ({
      id: normalizeString(withId('video', index, item).id),
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
      youtubeUrl: normalizeLink(item?.youtubeUrl, { fieldLabel: `${item?.title || 'Video'} linki` }),
      category: ['general', 'restaurant', 'market'].includes(String(item?.category || '').trim()) ? String(item.category).trim() : 'general',
      active: normalizeBoolean(item?.active, true),
      sortOrder: normalizeNumber(item?.sortOrder, index + 1)
    })),
    integrations: (Array.isArray(source.integrations) ? source.integrations : defaults.integrations).map((item, index) => ({
      id: normalizeString(withId('integration', index, item).id),
      name: normalizeString(item?.name),
      description: normalizeString(item?.description),
      active: normalizeBoolean(item?.active, true),
      sortOrder: normalizeNumber(item?.sortOrder, index + 1)
    })),
    seoTitle: normalizeString(source.seoTitle, defaults.seoTitle),
    seoDescription: normalizeString(source.seoDescription, defaults.seoDescription),
    seoKeywords: normalizeString(source.seoKeywords, defaults.seoKeywords),
    isPublished: normalizeBoolean(source.isPublished, true)
  }
}

const toPublicShape = (doc) => {
  const normalized = normalizeWebsiteSettings(doc || {})
  return {
    ...normalized,
    updatedAt: doc?.updatedAt || null
  }
}

export const getWebsiteSettingsService = async () => {
  let doc = await WebsiteSettings.findOne({ key: 'primary' }).lean()
  if (!doc) {
    doc = await WebsiteSettings.create({ key: 'primary', ...getDefaultWebsiteSettings() })
    return toPublicShape(doc?.toObject ? doc.toObject() : doc)
  }
  return toPublicShape(doc)
}

export const updateWebsiteSettingsService = async (payload = {}) => {
  const next = normalizeWebsiteSettings(payload)
  const doc = await WebsiteSettings.findOneAndUpdate(
    { key: 'primary' },
    { $set: { ...next, key: 'primary' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  return toPublicShape(doc)
}
