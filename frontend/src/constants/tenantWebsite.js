export const WEBSITE_SECTION_TYPES = [
  { type: 'hero', label: 'Kapak Alanı' },
  { type: 'products', label: 'Ürünler / Menü' },
  { type: 'about', label: 'Hakkımızda' },
  { type: 'contact', label: 'İletişim' },
  { type: 'map', label: 'Harita' },
  { type: 'social', label: 'Sosyal Medya' },
  { type: 'buttons', label: 'Butonlar' },
  { type: 'qrMenu', label: 'QR Menü Bağlantısı' },
  { type: 'onlineOrder', label: 'Online Sipariş' },
  { type: 'customText', label: 'Özel Metin Alanı' },
]

export const defaultTenantWebsiteSettings = {
  enabled: true,
  published: false,
  slug: '',
  theme: {
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
    primaryColor: '#d9b56f',
    secondaryColor: '#1f2937',
    buttonColor: '#d9b56f',
    buttonTextColor: '#111827',
    cardColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
  },
  layout: {
    maxWidth: '1180px',
    headerStyle: 'centered',
    sectionSpacing: 32,
    contentAlign: 'left',
  },
  hero: {
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
    buttonLink: '',
  },
  sections: [
    { id: 'hero-1', type: 'hero', title: 'Kapak Alanı', subtitle: '', content: '', visible: true, order: 1, settings: {} },
    { id: 'products-1', type: 'products', title: 'Menü / Ürünler', subtitle: 'Ürünlerinizi müşterilerinize gösterin.', content: '', visible: true, order: 2, settings: { categoryMode: 'all', cardStyle: 'grid' } },
    { id: 'about-1', type: 'about', title: 'Hakkımızda', subtitle: '', content: 'İşletmeniz hakkında kısa bir açıklama paylaşın.', visible: true, order: 3, settings: { imageUrl: '', align: 'left' } },
    { id: 'contact-1', type: 'contact', title: 'İletişim', subtitle: '', content: '', visible: true, order: 4, settings: {} },
  ],
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    mapUrl: '',
    instagram: '',
    facebook: '',
    tiktok: '',
  },
  integrations: {
    showQrMenu: true,
    qrMenuUrl: '',
    showProducts: true,
    showOnlineOrder: false,
    onlineOrderUrl: '',
  },
  seo: {
    title: '',
    description: '',
  },
  updatedAt: null,
  publishedAt: null,
}

export const cloneWebsiteSettings = (value) => JSON.parse(JSON.stringify(value))

export const normalizeSectionOrder = (sections = []) =>
  (Array.isArray(sections) ? sections : []).map((section, index) => ({ ...section, order: index + 1 }))

export const sectionTypeLabel = (type) =>
  WEBSITE_SECTION_TYPES.find((item) => item.type === type)?.label || 'Özel Bölüm'

export const moveWebsiteSection = (sections = [], index, direction) => {
  const next = [...sections]
  const target = index + direction
  if (target < 0 || target >= next.length) return normalizeSectionOrder(next)
  ;[next[index], next[target]] = [next[target], next[index]]
  return normalizeSectionOrder(next)
}

export const createWebsiteSection = (type, nextIndex) => ({
  id: `${String(type || 'section')}-${Date.now()}-${nextIndex}`,
  type,
  title: sectionTypeLabel(type),
  subtitle: '',
  content: '',
  visible: true,
  order: nextIndex,
  settings: {},
})

export const getWebsitePublicUrl = ({ slug, previewPath = '/site', subdomainHost = 'penpos.cloud' }) => {
  const safeSlug = String(slug || '').trim()
  if (!safeSlug) return ''
  const host = String(window.location?.hostname || '').trim().toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const protocol = String(window.location?.protocol || 'https:')
  const port = String(window.location?.port || '').trim()
  if (isLocal) return `${window.location.origin}${previewPath}/${safeSlug}`
  const fullHost = port ? `${safeSlug}.${subdomainHost}:${port}` : `${safeSlug}.${subdomainHost}`
  return `${protocol}//${fullHost}`
}

export const platformWebsiteToBuilder = (settings = {}) => ({
  ...cloneWebsiteSettings(defaultTenantWebsiteSettings),
  published: !!settings.isPublished,
  slug: 'penpos',
  hero: {
    ...cloneWebsiteSettings(defaultTenantWebsiteSettings.hero),
    title: settings.heroTitle || settings.siteTitle || 'PenPOS',
    subtitle: settings.heroDescription || settings.siteDescription || '',
    buttonText: settings.primaryCtaText || '1 Hafta Ücretsiz Dene',
    buttonLink: settings.registerUrl || '/register',
  },
  sections: [
    { id: 'hero-1', type: 'hero', title: 'Kapak Alanı', subtitle: '', content: '', visible: true, order: 1, settings: {} },
    { id: 'features-1', type: 'customText', title: 'Özellikler', subtitle: 'PenPOS öne çıkanlar', content: settings.siteDescription || '', visible: true, order: 2, settings: { variant: 'featureList', items: Array.isArray(settings.features) ? settings.features : [] } },
    { id: 'pricing-1', type: 'customText', title: 'Paketler / Fiyatlar', subtitle: '', content: '', visible: true, order: 3, settings: { variant: 'pricing', items: Array.isArray(settings.pricingPlans) ? settings.pricingPlans : [] } },
    { id: 'videos-1', type: 'customText', title: 'Eğitim Videoları', subtitle: '', content: '', visible: true, order: 4, settings: { variant: 'videos', items: Array.isArray(settings.trainingVideos) ? settings.trainingVideos : [] } },
    { id: 'contact-1', type: 'contact', title: 'İletişim', subtitle: '', content: '', visible: true, order: 5, settings: { variant: 'platformCards', items: Array.isArray(settings.integrations) ? settings.integrations : [] } },
  ],
  contact: {
    ...cloneWebsiteSettings(defaultTenantWebsiteSettings.contact),
    phone: settings.phone || '',
    email: settings.email || '',
    address: settings.address || '',
    whatsapp: settings.whatsappUrl || '',
  },
  integrations: {
    ...cloneWebsiteSettings(defaultTenantWebsiteSettings.integrations),
    showQrMenu: false,
    showProducts: false,
    showOnlineOrder: false,
  },
  seo: {
    title: settings.seoTitle || settings.siteTitle || 'PenPOS',
    description: settings.seoDescription || settings.siteDescription || '',
  },
})

export const builderToPlatformWebsite = (builder = {}, base = {}) => {
  const sections = Array.isArray(builder.sections) ? builder.sections : []
  const featuresSection = sections.find((section) => section?.settings?.variant === 'featureList')
  const pricingSection = sections.find((section) => section?.settings?.variant === 'pricing')
  const videosSection = sections.find((section) => section?.settings?.variant === 'videos')
  const contactSection = sections.find((section) => section?.type === 'contact')
  return {
    ...base,
    siteTitle: builder?.seo?.title || base.siteTitle || 'PenPOS',
    siteDescription: featuresSection?.content || builder?.hero?.subtitle || base.siteDescription || '',
    heroTitle: builder?.hero?.title || base.heroTitle || '',
    heroDescription: builder?.hero?.subtitle || base.heroDescription || '',
    primaryCtaText: builder?.hero?.buttonText || base.primaryCtaText || '',
    registerUrl: builder?.hero?.buttonLink || base.registerUrl || '/register',
    phone: builder?.contact?.phone || '',
    email: builder?.contact?.email || '',
    address: builder?.contact?.address || '',
    whatsappUrl: builder?.contact?.whatsapp || '',
    features: Array.isArray(featuresSection?.settings?.items) ? featuresSection.settings.items : (base.features || []),
    pricingPlans: Array.isArray(pricingSection?.settings?.items) ? pricingSection.settings.items : (base.pricingPlans || []),
    trainingVideos: Array.isArray(videosSection?.settings?.items) ? videosSection.settings.items : (base.trainingVideos || []),
    integrations: Array.isArray(contactSection?.settings?.items) ? contactSection.settings.items : (base.integrations || []),
    seoTitle: builder?.seo?.title || base.seoTitle || '',
    seoDescription: builder?.seo?.description || base.seoDescription || '',
    isPublished: !!builder?.published,
  }
}
