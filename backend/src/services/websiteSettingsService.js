import WebsiteSettings from '../models/WebsiteSettings.js'

const withId = (prefix, index, value = {}) => ({
  ...value,
  id: String(value?.id || `${prefix}-${index + 1}`)
})

export const getDefaultWebsiteSettings = () => ({
  siteTitle: 'PenPOS',
  siteDescription: 'Restoran, cafe, kantin ve marketler için ayri akisli modern bulut otomasyon sistemi.',
  heroTitle: 'Restoran ve kantin sistemlerini ayri ayri yonet.',
  heroDescription: 'PenPOS; restoran-cafe ve kantin-market için ayri girisleri, ayri ekran akislari olan modern otomasyon yapisidir. Restoran tarafinda QR menü standart olarak dahildir; her isletme istedigi kadar şube acabilir.',
  trialDays: 7,
  primaryCtaText: '1 Haftalik Ucretsiz Deneme Baslat',
  secondaryCtaText: 'Uye Olmadan Önce Incele',
  restaurantLoginUrl: '/login?type=restaurant',
  marketLoginUrl: '/login?type=market',
  registerUrl: '/register',
  whatsappUrl: '',
  phone: '',
  email: '',
  address: '',
  features: [
    { id: 'feature-1', icon: 'utensils', title: 'Restoran ve cafe adisyon sistemi', text: 'Masa, paket servis, gel-al, mutfak ciktisi ve QR menü dahil olacak sekilde restoran akislarini yonetin.', sortOrder: 1, active: true },
    { id: 'feature-2', icon: 'store', title: 'Kantin ve market otomasyonu', text: 'Barkod okutun, hızlı satis yapin, cari hesaplari izleyin ve stok giris-cikislarini tek panelden takip edin.', sortOrder: 2, active: true },
    { id: 'feature-3', icon: 'smartphone', title: 'Telefondan satis yapin', text: 'Kantin ve market sistemi telefon, tablet veya bilgisayardan online market mantigiyla satis yapmaya uygundur.', sortOrder: 3, active: true },
    { id: 'feature-4', icon: 'qr', title: 'QR menü standart dahil', text: 'Restoran tarafinda QR menü ekstra modul degil, sistemin dogal parcasidir.', sortOrder: 4, active: true },
    { id: 'feature-5', icon: 'layers', title: 'Sınırsız şube yapisi', text: 'Isletmenize ait istediginiz kadar şube acabilir ve hepsini ayni altyapidan yonetebilirsiniz.', sortOrder: 5, active: true },
    { id: 'feature-6', icon: 'chart', title: 'Raporlama ve yazici desteği', text: 'Ciro, stok, cari ve satis raporlariyla birlikte fiş ve mutfak yazici akislari hazır gelir.', sortOrder: 6, active: true }
  ],
  systemCards: [
    { id: 'system-restaurant', type: 'restaurant', title: 'Restoran / Cafe Sistemi', description: 'Masa, adisyon, paket servis, mutfak ciktisi ve QR menü odakli ayri restoran paneli.', bullets: ['Masa ve adisyon', 'Mutfak ciktisi', 'Paket servis', 'QR menü dahil', 'Sınırsız şube acma'], active: true },
    { id: 'system-market', type: 'market', title: 'Kantin / Market Sistemi', description: 'Online market programi gibi pratik calisir; telefon, tablet veya bilgisayardan satis yapilabilir.', bullets: ['Telefondan satis', 'Barkod okuma', 'Cari hesap', 'Stok giris-çıkış', 'Sınırsız şube acma'], active: true }
  ],
  pricingPlans: [
    { id: 'plan-restaurant', name: 'Restoran / Cafe', price: '₺899', period: '/ ay', description: 'Masa, adisyon, paket servis, mutfak ve QR menü kullanimi için.', items: ['Masa ve adisyon', 'Paket servis', 'QR menü dahil', 'Sınırsız şube acma', 'Raporlar ve yazici'], popular: true, buttonText: 'Basvuru Yap / Uye Ol', buttonUrl: '/register?type=restaurant', active: true, sortOrder: 1 },
    { id: 'plan-market', name: 'Kantin / Market', price: '₺399', period: '/ ay', description: 'Barkodlu satis, stok, cari ve hızlı kasa kullanimi için.', items: ['Telefondan satis', 'Barkod okuma', 'Cari hesap', 'Stok giris-çıkış', 'Sınırsız şube acma'], popular: false, buttonText: 'Basvuru Yap / Uye Ol', buttonUrl: '/register?type=market', active: true, sortOrder: 2 },
    { id: 'plan-support', name: 'Kurulum & Destek', price: 'Ozel', period: '', description: 'Veri aktarma, yazici kurulumu veya ozel destek isteyen isletmeler için.', items: ['Ürün aktarimi', 'Şube kurulumu', 'Yazici kurulumu', 'Egitim destegi', 'Ozel yonlendirme'], popular: false, buttonText: 'Iletisime Gec', buttonUrl: '', active: true, sortOrder: 3 },
    { id: 'plan-integration', name: 'Ozel Entegrasyon', price: 'Ozel', period: '', description: 'Ileri seviye bağlantı, ozel rapor veya isletmeye ozel gelistirme ihtiyaci olanlar için.', items: ['Ozel entegrasyon', 'Ek rapor gelistirme', 'Markaya ozel duzenleme', 'Teknik analiz', 'Proje bazli calisma'], popular: false, buttonText: 'Teklif Al', buttonUrl: '', active: true, sortOrder: 4 }
  ],
  trainingVideos: [
    { id: 'video-1', title: 'Uyelik ve Ilk Kurulum', description: 'Ilk hesap acilisi ve panel tanitimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 1 },
    { id: 'video-2', title: 'Restoran Satis Akisi', description: 'Masa ve adisyon akisinin temel kullanimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'restaurant', active: true, sortOrder: 2 },
    { id: 'video-3', title: 'Kantin Barkodlu Satis', description: 'Hızlı kasa ve barkodlu satis ornegi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'market', active: true, sortOrder: 3 },
    { id: 'video-4', title: 'Stok Girisi / Cikisi', description: 'Stok hareketlerinin yönetimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'market', active: true, sortOrder: 4 },
    { id: 'video-5', title: 'Cari Hesap Kullanimi', description: 'Cari hesap takibi ve islemler.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 5 },
    { id: 'video-6', title: 'Raporlar ve Gün Sonu', description: 'Gün sonu ve raporlama ekranlari.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 6 },
    { id: 'video-7', title: 'Yazici Ayarlari', description: 'Fis ve mutfak yazıcısı ayarlari.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 7 },
    { id: 'video-8', title: 'QR Menü Kullanimi', description: 'QR menü paylasimi ve kullanimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'restaurant', active: true, sortOrder: 8 }
  ],
  integrations: [
    { id: 'integration-1', name: 'Bulut Erisim', description: 'Telefon, tablet ve bilgisayardan ayni veri yapisina erisim.', active: true, sortOrder: 1 },
    { id: 'integration-2', name: 'Yazici Altyapisi', description: 'Fis, mutfak ve hızlı kasa yazici akislarini destekler.', active: true, sortOrder: 2 },
    { id: 'integration-3', name: 'Rapor Altyapisi', description: 'Şube, satis ve operasyon raporlarini birlikte sunar.', active: true, sortOrder: 3 }
  ],
  seoTitle: 'PenPOS | Restoran ve Kantin Otomasyonu',
  seoDescription: 'PenPOS ile restoran/cafe ve kantin/market akislari ayri girislerle yonetilir. QR menu dahil, sinirsiz sube ve raporlama hazir.',
  seoKeywords: 'penpos,pos,restoran otomasyonu,kantin otomasyonu,market otomasyonu,qr menü',
  isPublished: true
})

const normalizeString = (value, fallback = '') => String(value ?? fallback).trim()
const normalizeBoolean = (value, fallback = false) => value === undefined ? fallback : !!value
const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const normalizeStringList = (list = []) => Array.isArray(list) ? list.map((item) => normalizeString(item)).filter(Boolean) : []

export const normalizeWebsiteSettings = (input = {}) => {
  const defaults = getDefaultWebsiteSettings()
  const source = { ...defaults, ...(input || {}) }
  return {
    siteTitle: normalizeString(source.siteTitle, defaults.siteTitle),
    siteDescription: normalizeString(source.siteDescription, defaults.siteDescription),
    heroTitle: normalizeString(source.heroTitle, defaults.heroTitle),
    heroDescription: normalizeString(source.heroDescription, defaults.heroDescription),
    trialDays: normalizeNumber(source.trialDays, defaults.trialDays),
    primaryCtaText: normalizeString(source.primaryCtaText, defaults.primaryCtaText),
    secondaryCtaText: normalizeString(source.secondaryCtaText, defaults.secondaryCtaText),
    restaurantLoginUrl: normalizeString(source.restaurantLoginUrl, defaults.restaurantLoginUrl),
    marketLoginUrl: normalizeString(source.marketLoginUrl, defaults.marketLoginUrl),
    registerUrl: normalizeString(source.registerUrl, defaults.registerUrl),
    whatsappUrl: normalizeString(source.whatsappUrl, defaults.whatsappUrl),
    phone: normalizeString(source.phone, defaults.phone),
    email: normalizeString(source.email, defaults.email),
    address: normalizeString(source.address, defaults.address),
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
      buttonUrl: normalizeString(item?.buttonUrl),
      active: normalizeBoolean(item?.active, true),
      sortOrder: normalizeNumber(item?.sortOrder, index + 1)
    })),
    trainingVideos: (Array.isArray(source.trainingVideos) ? source.trainingVideos : defaults.trainingVideos).map((item, index) => ({
      id: normalizeString(withId('video', index, item).id),
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
      youtubeUrl: normalizeString(item?.youtubeUrl),
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
