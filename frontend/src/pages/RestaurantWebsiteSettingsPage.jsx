import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImageUploadField from '../components/ProductImageUploadField.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

const DEFAULT_SECTIONS = {
  about: {
    id: 'about-1',
    type: 'about',
    title: 'Bizim Mekan',
    subtitle: 'Sakin, modern ve gün boyu yaşayan bir kafe restoranı.',
    content: 'Günün ilk kahvesinden akşam paylaşım tabaklarına kadar sade ama karakterli bir deneyim sunuyoruz.',
    visible: true,
    order: 3,
    settings: {
      imageUrl: '',
      align: 'left',
      manifestoLabel: '01 / Manifesto',
      manifestoText: 'Her tabak bir reçete değil, bir karakter taşır.',
      sectionLabel: '02 / Mekan',
    },
  },
  products: {
    id: 'products-1',
    type: 'products',
    title: 'Öne Çıkan Lezzetler',
    subtitle: 'Ayarlar ekranında seçtiğiniz ürünler burada otomatik yer alır.',
    content: '',
    visible: true,
    order: 2,
    settings: {
      categoryMode: 'selected',
      cardStyle: 'grid',
      featuredProductIds: [],
      galleryLabel: 'Galeri',
      galleryTitle: 'Mekân ve detay fotoğrafları',
      galleryDescription: 'Ayarlardan yüklediğiniz galeri görselleri burada gösterilir.',
      emptyStateText: 'Gösterilecek öne çıkan ürün bulunamadı.',
      productFallbackDescription: 'Açıklama yakında eklenecek.',
      imageFallbackText: 'Görsel Yok',
    },
  },
  contact: {
    id: 'contact-1',
    type: 'contact',
    title: 'Uğramadan Önce',
    subtitle: 'Adres, iletişim ve yönlendirmeler tek alanda.',
    content: '',
    visible: true,
    order: 4,
    settings: {
      addressLabel: 'Adres',
      reservationLabel: 'Rezervasyon',
      quoteText: 'İyi yemek acele etmez. Ama iyi sipariş hızlı olmalıdır.',
      quoteAuthor: 'Kitchen Philosophy',
      emptyAddressText: 'Adres bilgisi eklenmedi',
      emptyReservationText: 'İletişim bilgisi eklenmedi',
      mapLinkText: 'Haritada Aç',
    },
  },
}

const STORE_SAMPLE_COPY = {
  heroTitle: 'Yeni sezon ürünlerini tek vitrinde sergileyin',
  heroSubtitle: 'Kampanyalarınızı, çok satan ürünlerinizi ve çevrimiçi sipariş akışınızı sade bir mağaza sayfasında toplayın.',
  heroKickerText: 'Mağaza · Kampanya · Hızlı Sipariş',
  heroButtonText: 'Çevrimiçi Siparişi Aç',
  navigation: {
    storyLabel: 'Koleksiyon',
    menuLabel: 'Ürünler',
    contactLabel: 'Teslimat',
    onlineButtonText: 'Çevrimiçi Sipariş',
  },
  products: {
    title: 'Öne Çıkan Ürünler',
    subtitle: 'En çok ilgi gören ürünleri vitrinde öne çıkarıp müşteriye hızlı seçim alanı sunun.',
    galleryLabel: 'Detaylar',
    galleryTitle: 'Ürün ve paket fotoğrafları',
    galleryDescription: 'Mağaza atmosferini, paket detaylarını ve kampanya görsellerini burada sergileyin.',
    emptyStateText: 'Henüz vitrine eklenmiş ürün yok.',
    productFallbackDescription: 'Kısa ürün açıklaması burada görünür.',
    imageFallbackText: 'Ürün Görseli',
  },
  about: {
    title: 'Mağazamız',
    subtitle: 'Günlük ihtiyaç, özel seçki ve hızlı teslimat tek yerde.',
    content: 'Mahallenin sevdiği ürünleri özenle seçip temiz, hızlı ve güvenilir bir alışveriş deneyimi sunuyoruz.',
    manifestoLabel: '01 / Vitrin',
    manifestoText: 'Doğru ürün, temiz sunum ve hızlı teslimat iyi mağaza deneyiminin temelidir.',
    sectionLabel: '02 / Mağaza',
  },
  contact: {
    title: 'Sipariş ve Teslimat',
    subtitle: 'Teslimat bölgesi, iletişim ve sipariş notları tek alanda.',
    addressLabel: 'Teslimat Bölgesi',
    reservationLabel: 'Sipariş Hattı',
    quoteText: 'Hızlı sipariş, temiz paketleme ve güven veren teslimat.',
    quoteAuthor: 'Store Service Standard',
    emptyAddressText: 'Teslimat bölgesi bilgisi eklenmedi',
    emptyReservationText: 'Sipariş hattı bilgisi eklenmedi',
    mapLinkText: 'Konumu Aç',
  },
}

const createEmptyGalleryItem = () => ({
  id: `gallery-${Math.random().toString(36).slice(2, 9)}`,
  url: '',
  file: null,
  error: '',
})

const isStoreWebsiteSystem = (systemType) => {
  const normalized = String(systemType || '').trim().toLocaleLowerCase('tr-TR')
  return normalized === 'canteen' || normalized === 'kantin'
}

function ensureWebsiteShape(settings, systemType = 'kermes') {
  const isStore = isStoreWebsiteSystem(systemType)
  const safe = settings && typeof settings === 'object' ? settings : {}
  const sections = Array.isArray(safe.sections) ? safe.sections : []
  const byType = new Map(sections.map((section) => [String(section?.type || ''), section]))
  const hero = safe.hero && typeof safe.hero === 'object' ? safe.hero : {}
  const contact = safe.contact && typeof safe.contact === 'object' ? safe.contact : {}
  const integrations = safe.integrations && typeof safe.integrations === 'object' ? safe.integrations : {}
  const seo = safe.seo && typeof safe.seo === 'object' ? safe.seo : {}
  const theme = safe.theme && typeof safe.theme === 'object' ? safe.theme : {}
  const navigation = safe.navigation && typeof safe.navigation === 'object' ? safe.navigation : {}
  const normalizedSlug = String(safe.slug || '').trim()
  const gallery = Array.isArray(hero.galleryImages) && hero.galleryImages.length
    ? hero.galleryImages.map((item, index) => ({
        id: item?.id || `gallery-${index + 1}`,
        url: String(item?.url || item || ''),
        file: null,
        error: '',
      }))
    : [createEmptyGalleryItem(), createEmptyGalleryItem(), createEmptyGalleryItem()]

  return {
    ...safe,
    slug: normalizedSlug,
    enabled: safe.enabled !== false,
    published: safe.published === true,
    theme: {
      primaryColor: String(theme.primaryColor || '#d1d5db'),
      secondaryColor: String(theme.secondaryColor || '#9ca3af'),
      backgroundColor: String(theme.backgroundColor || '#e5e7eb'),
      textColor: String(theme.textColor || '#111827'),
      buttonColor: String(theme.buttonColor || '#d1d5db'),
      buttonTextColor: String(theme.buttonTextColor || '#111827'),
      cardColor: String(theme.cardColor || 'rgba(255, 255, 255, 0.82)'),
      borderRadius: Number(theme.borderRadius || 30) || 30,
      fontFamily: String(theme.fontFamily || 'Georgia, serif'),
    },
    hero: {
      visible: hero.visible !== false,
      title: String(hero.title || (isStore ? STORE_SAMPLE_COPY.heroTitle : 'Modern, sıcak ve sade bir masa deneyimi')),
      subtitle: String(hero.subtitle || (isStore ? STORE_SAMPLE_COPY.heroSubtitle : 'Restoran vitrininizi ayarlardan yönetin; QR menüyü ve çevrimiçi satışı tek sayfada buluşturun.')),
      kickerText: String(hero.kickerText || (isStore ? 'Mağaza · Market · İşletmeniz' : 'Kafe · Restoran · İşletmeniz')),
      logoUrl: String(hero.logoUrl || ''),
      coverImageUrl: String(hero.coverImageUrl || ''),
      backgroundColor: String(hero.backgroundColor || '#e5e7eb'),
      titleSize: Number(hero.titleSize || 54) || 54,
      subtitleSize: Number(hero.subtitleSize || 18) || 18,
      align: String(hero.align || 'left'),
      buttonText: String(hero.buttonText || (isStore ? STORE_SAMPLE_COPY.heroButtonText : 'QR Menüyü Aç')),
      buttonLink: String(hero.buttonLink || ''),
      galleryImages: gallery,
    },
    navigation: {
      storyLabel: String(navigation.storyLabel || (isStore ? STORE_SAMPLE_COPY.navigation.storyLabel : 'Hikâye')),
      menuLabel: String(navigation.menuLabel || (isStore ? STORE_SAMPLE_COPY.navigation.menuLabel : 'Menü')),
      contactLabel: String(navigation.contactLabel || (isStore ? STORE_SAMPLE_COPY.navigation.contactLabel : 'İletişim')),
      qrButtonText: String(navigation.qrButtonText || 'QR Menü'),
      cartButtonText: String(navigation.cartButtonText || 'Sepet'),
      onlineButtonText: String(navigation.onlineButtonText || (isStore ? STORE_SAMPLE_COPY.navigation.onlineButtonText : 'Çevrimiçi Sipariş')),
    },
    sections: [
      {
        ...DEFAULT_SECTIONS.products,
        ...(isStore ? {
          title: STORE_SAMPLE_COPY.products.title,
          subtitle: STORE_SAMPLE_COPY.products.subtitle,
        } : {}),
        ...(byType.get('products') || {}),
        settings: {
          ...DEFAULT_SECTIONS.products.settings,
          ...(isStore ? {
            galleryLabel: STORE_SAMPLE_COPY.products.galleryLabel,
            galleryTitle: STORE_SAMPLE_COPY.products.galleryTitle,
            galleryDescription: STORE_SAMPLE_COPY.products.galleryDescription,
            emptyStateText: STORE_SAMPLE_COPY.products.emptyStateText,
            productFallbackDescription: STORE_SAMPLE_COPY.products.productFallbackDescription,
            imageFallbackText: STORE_SAMPLE_COPY.products.imageFallbackText,
          } : {}),
          ...((byType.get('products')?.settings && typeof byType.get('products').settings === 'object') ? byType.get('products').settings : {}),
          featuredProductIds: Array.isArray(byType.get('products')?.settings?.featuredProductIds)
            ? byType.get('products').settings.featuredProductIds.map((item) => String(item || '')).filter(Boolean)
            : [],
        },
      },
      {
        ...DEFAULT_SECTIONS.about,
        ...(isStore ? {
          title: STORE_SAMPLE_COPY.about.title,
          subtitle: STORE_SAMPLE_COPY.about.subtitle,
          content: STORE_SAMPLE_COPY.about.content,
        } : {}),
        ...(byType.get('about') || {}),
        settings: {
          ...DEFAULT_SECTIONS.about.settings,
          ...(isStore ? {
            manifestoLabel: STORE_SAMPLE_COPY.about.manifestoLabel,
            manifestoText: STORE_SAMPLE_COPY.about.manifestoText,
            sectionLabel: STORE_SAMPLE_COPY.about.sectionLabel,
          } : {}),
          ...((byType.get('about')?.settings && typeof byType.get('about').settings === 'object') ? byType.get('about').settings : {}),
        },
      },
      {
        ...DEFAULT_SECTIONS.contact,
        ...(isStore ? {
          title: STORE_SAMPLE_COPY.contact.title,
          subtitle: STORE_SAMPLE_COPY.contact.subtitle,
        } : {}),
        ...(byType.get('contact') || {}),
        settings: {
          ...DEFAULT_SECTIONS.contact.settings,
          ...(isStore ? {
            addressLabel: STORE_SAMPLE_COPY.contact.addressLabel,
            reservationLabel: STORE_SAMPLE_COPY.contact.reservationLabel,
            quoteText: STORE_SAMPLE_COPY.contact.quoteText,
            quoteAuthor: STORE_SAMPLE_COPY.contact.quoteAuthor,
            emptyAddressText: STORE_SAMPLE_COPY.contact.emptyAddressText,
            emptyReservationText: STORE_SAMPLE_COPY.contact.emptyReservationText,
            mapLinkText: STORE_SAMPLE_COPY.contact.mapLinkText,
          } : {}),
          ...((byType.get('contact')?.settings && typeof byType.get('contact').settings === 'object') ? byType.get('contact').settings : {}),
        },
      },
    ],
    contact: {
      phone: String(contact.phone || ''),
      whatsapp: String(contact.whatsapp || ''),
      email: String(contact.email || ''),
      address: String(contact.address || ''),
      mapUrl: String(contact.mapUrl || ''),
      instagram: String(contact.instagram || ''),
      facebook: String(contact.facebook || ''),
      tiktok: String(contact.tiktok || ''),
    },
    integrations: {
      showQrMenu: isStore ? false : integrations.showQrMenu !== false,
      qrMenuUrl: normalizeWebsiteActionUrl(integrations.qrMenuUrl, 'menu', normalizedSlug),
      showProducts: integrations.showProducts !== false,
      showOnlineOrder: isStore ? integrations.showOnlineOrder !== false : integrations.showOnlineOrder === true,
      onlineOrderUrl: normalizeWebsiteActionUrl(integrations.onlineOrderUrl, 'online', normalizedSlug),
    },
    seo: {
      title: String(seo.title || ''),
      description: String(seo.description || ''),
    },
  }
}

function getSection(settings, type) {
  return (Array.isArray(settings?.sections) ? settings.sections : []).find((item) => String(item?.type || '') === type) || null
}

function updateSection(settings, type, updater) {
  return {
    ...settings,
    sections: (Array.isArray(settings?.sections) ? settings.sections : []).map((section) => {
      if (String(section?.type || '') !== type) return section
      return typeof updater === 'function' ? updater(section) : { ...section, ...updater }
    }),
  }
}

function normalizeWebsiteActionUrl(value, type, slug) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return new RegExp(`^(?:https?:\\/\\/[^/]+)?\\/?${type}\\/`, 'i').test(raw) ? `/${type}/${slug}` : raw
}

function buildWebsitePath(slug, systemType = 'kermes') {
  const safeSlug = String(slug || '').trim()
  const basePath = isStoreWebsiteSystem(systemType) ? '/wepmagaza' : '/weprestorant'
  return safeSlug ? `${basePath}/${safeSlug}` : ''
}

function getProductId(item) {
  return String(item?.id || item?._id || item?.productId || '').trim()
}

function normalizeProducts(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((item) => ({
      ...item,
      id: getProductId(item),
    }))
    .filter((item) => item.id)
}

export default function RestaurantWebsiteSettingsPage({ systemType = 'kermes' }) {
  const navigate = useNavigate()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const compact = isMobilePortrait || isTablet
  const isStore = isStoreWebsiteSystem(systemType)
  const websiteApiQuery = isStore ? '?siteType=store' : ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [settings, setSettings] = useState(() => ensureWebsiteShape({}, systemType))
  const [products, setProducts] = useState([])
  const [logoFile, setLogoFile] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverError, setCoverError] = useState('')
  const [aboutFile, setAboutFile] = useState(null)
  const [aboutError, setAboutError] = useState('')
  const [editingFeaturedIndex, setEditingFeaturedIndex] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    setLogoFile(null)
    setLogoError('')
    setCoverFile(null)
    setCoverError('')
    setAboutFile(null)
    setAboutError('')
    try {
      const [websiteRes, profileRes, branchesRes] = await Promise.all([
        api(`/api/tenant/website${websiteApiQuery}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/profile', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        isStore
          ? api('/api/magaza/branches', { silent: true, skipBranchHeader: true, portalOverride: 'canteen', cacheMode: 'no-store' })
          : Promise.resolve(null),
      ])
      const profileTenant = profileRes?.tenant && typeof profileRes.tenant === 'object' ? profileRes.tenant : {}
      const websiteTenant = websiteRes?.tenant && typeof websiteRes.tenant === 'object' ? websiteRes.tenant : {}
      const mergedTenant = { ...profileTenant, ...websiteTenant }
      const nextTenant = Object.keys(mergedTenant).length ? mergedTenant : null
      let nextProducts = []

      if (isStore) {
        const tenantBranches = Array.isArray(branchesRes?.branches) && branchesRes.branches.length
          ? branchesRes.branches
          : (Array.isArray(nextTenant?.branches) ? nextTenant.branches : [])
        const activeBranches = tenantBranches
          .map((branch) => ({
            id: String(branch?.id || branch?._id || ''),
            isActive: branch?.isActive !== false,
          }))
          .filter((branch) => branch.id && branch.isActive !== false)
        const allowedIds = Array.isArray(nextTenant?.canteenAllowedBranchIds)
          ? nextTenant.canteenAllowedBranchIds.map(String).filter(Boolean)
          : []
        const selectedBranchId = (allowedIds.length > 0
          ? activeBranches.find((branch) => allowedIds.includes(branch.id))?.id
          : activeBranches[0]?.id) || activeBranches[0]?.id || ''

        if (selectedBranchId) {
          const productsRes = await api(`/api/magaza/products?branchId=${encodeURIComponent(selectedBranchId)}`, {
            silent: true,
            skipBranchHeader: true,
            portalOverride: 'canteen',
            cacheMode: 'no-store',
          })
          nextProducts = normalizeProducts(productsRes?.products || [])
        }
      } else {
        const menuRes = await api('/api/tenant/menu-items?active=true', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
        nextProducts = normalizeProducts(menuRes?.items || [])
      }

      setTenant(nextTenant)
      setSettings(ensureWebsiteShape(websiteRes?.settings || {}, systemType))
      setProducts(nextProducts)
    } catch (err) {
      setError(err?.message || 'Web sitesi ayarları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const livePath = useMemo(() => buildWebsitePath(settings.slug, systemType), [settings.slug, systemType])
  const liveUrl = useMemo(() => {
    if (!livePath) return ''
    try {
      return new URL(livePath, window.location.origin).toString()
    } catch {
      return livePath
    }
  }, [livePath])

  const productsSection = getSection(settings, 'products') || DEFAULT_SECTIONS.products
  const aboutSection = getSection(settings, 'about') || DEFAULT_SECTIONS.about
  const contactSection = getSection(settings, 'contact') || DEFAULT_SECTIONS.contact
  const featuredIds = Array.isArray(productsSection?.settings?.featuredProductIds) ? productsSection.settings.featuredProductIds : []
  const featuredProducts = featuredIds
    .map((id) => products.find((item) => getProductId(item) === String(id)))
    .filter(Boolean)

  const updateTopLevel = (key, value) => setSettings((current) => ({ ...current, [key]: value }))
  const updateHero = (key, value) => setSettings((current) => ({ ...current, hero: { ...(current.hero || {}), [key]: value } }))
  const updateNavigation = (key, value) => setSettings((current) => ({ ...current, navigation: { ...(current.navigation || {}), [key]: value } }))
  const updateContact = (key, value) => setSettings((current) => ({ ...current, contact: { ...(current.contact || {}), [key]: value } }))
  const updateIntegration = (key, value) => setSettings((current) => ({ ...current, integrations: { ...(current.integrations || {}), [key]: value } }))
  const updateSeo = (key, value) => setSettings((current) => ({ ...current, seo: { ...(current.seo || {}), [key]: value } }))
  const updateSectionCopy = (type, key, value) => setSettings((current) => updateSection(current, type, (section) => ({ ...section, [key]: value })))
  const updateSectionSettings = (type, key, value) => {
    setSettings((current) => updateSection(current, type, (section) => ({
      ...section,
      settings: {
        ...(section?.settings || {}),
        [key]: value,
      },
    })))
  }

  const setGalleryFile = (id, file, nextError = '') => {
    setSettings((current) => ({
      ...current,
      hero: {
        ...(current.hero || {}),
        galleryImages: (Array.isArray(current.hero?.galleryImages) ? current.hero.galleryImages : []).map((item) => (
          item.id === id ? { ...item, file, error: nextError || '' } : item
        )),
      },
    }))
  }

  const addGalleryItem = () => {
    setSettings((current) => ({
      ...current,
      hero: {
        ...(current.hero || {}),
        galleryImages: [...(Array.isArray(current.hero?.galleryImages) ? current.hero.galleryImages : []), createEmptyGalleryItem()],
      },
    }))
  }

  const removeGalleryItem = (id) => {
    setSettings((current) => ({
      ...current,
      hero: {
        ...(current.hero || {}),
        galleryImages: (Array.isArray(current.hero?.galleryImages) ? current.hero.galleryImages : []).filter((item) => item.id !== id),
      },
    }))
  }

  const addFeaturedProduct = () => {
    const firstId = getProductId(products?.[0])
    if (!firstId) return
    updateSectionSettings('products', 'featuredProductIds', [...featuredIds, firstId])
  }

  const updateFeaturedProduct = (index, value) => {
    const next = [...featuredIds]
    next[index] = value
    updateSectionSettings('products', 'featuredProductIds', next.filter(Boolean))
  }

  const removeFeaturedProduct = (index) => {
    const next = [...featuredIds]
    next.splice(index, 1)
    updateSectionSettings('products', 'featuredProductIds', next)
    setEditingFeaturedIndex((current) => {
      if (current === index) return null
      if (typeof current === 'number' && current > index) return current - 1
      return current
    })
  }

  const uploadWebsiteMedia = async (kind, file) => {
    const body = new FormData()
    body.append('file', file)
    const res = await api(`/api/tenant/website/media/${kind}`, {
      method: 'POST',
      body,
      silent: true,
      skipBranchHeader: true,
    })
    if (res?.success === false) {
      throw new Error(res?.message || 'Görsel yüklenemedi')
    }
    return String(res?.imageUrl || '').trim()
  }

  const uploadPendingImages = async () => {
    let next = {
      ...settings,
      hero: {
        ...(settings.hero || {}),
        galleryImages: (Array.isArray(settings.hero?.galleryImages) ? settings.hero.galleryImages : []).map((item) => ({
          ...item,
        })),
      },
      sections: (Array.isArray(settings.sections) ? settings.sections : []).map((section) => ({
        ...section,
        settings: {
          ...(section?.settings || {}),
        },
      })),
    }

    if (logoFile) {
      const imageUrl = await uploadWebsiteMedia('logo', logoFile)
      next = { ...next, hero: { ...(next.hero || {}), logoUrl: imageUrl } }
    }

    if (coverFile) {
      const imageUrl = await uploadWebsiteMedia('cover', coverFile)
      next = { ...next, hero: { ...(next.hero || {}), coverImageUrl: imageUrl } }
    }

    if (aboutFile) {
      const imageUrl = await uploadWebsiteMedia('about', aboutFile)
      next = updateSection(next, 'about', (section) => ({
        ...section,
        settings: {
          ...(section?.settings || {}),
          imageUrl,
        },
      }))
    }

    const gallery = []
    for (const item of (Array.isArray(next.hero?.galleryImages) ? next.hero.galleryImages : [])) {
      if (item?.file) {
        const imageUrl = await uploadWebsiteMedia('gallery', item.file)
        gallery.push({ ...item, url: imageUrl, file: null, error: '' })
      } else if (String(item?.url || '').trim()) {
        gallery.push({ ...item, file: null, error: '' })
      }
    }

    next = {
      ...next,
      hero: {
        ...(next.hero || {}),
        galleryImages: gallery,
      },
    }

    return next
  }

  const buildPayload = (sourceSettings) => {
    const sourceProductsSection = getSection(sourceSettings, 'products')
    const sourceFeaturedIds = Array.isArray(sourceProductsSection?.settings?.featuredProductIds)
      ? sourceProductsSection.settings.featuredProductIds.map((item) => String(item || '')).filter(Boolean)
      : []
    const galleryImages = (Array.isArray(sourceSettings.hero?.galleryImages) ? sourceSettings.hero.galleryImages : [])
      .map((item) => ({ id: String(item?.id || ''), url: String(item?.url || '').trim() }))
      .filter((item) => item.url)

    const nextHero = {
      ...(sourceSettings.hero || {}),
      galleryImages,
      buttonLink: sourceSettings.integrations?.onlineOrderUrl || sourceSettings.integrations?.qrMenuUrl || sourceSettings.hero?.buttonLink || '',
    }

    return {
      slug: String(sourceSettings.slug || '').trim(),
      enabled: sourceSettings.enabled !== false,
      theme: sourceSettings.theme,
      navigation: sourceSettings.navigation,
      hero: nextHero,
      contact: sourceSettings.contact,
      integrations: sourceSettings.integrations,
      seo: sourceSettings.seo,
      sections: [
        {
          ...sourceProductsSection,
          settings: {
            ...(sourceProductsSection?.settings || {}),
            featuredProductIds: sourceFeaturedIds,
          },
        },
        getSection(sourceSettings, 'about'),
        getSection(sourceSettings, 'contact'),
      ],
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const preparedSettings = await uploadPendingImages()
      const res = await api(`/api/tenant/website${websiteApiQuery}`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload(preparedSettings)),
        silent: true,
        skipBranchHeader: true,
      })
      setTenant(res?.tenant || tenant)
      setSettings(ensureWebsiteShape(res?.settings || preparedSettings, systemType))
      setLogoFile(null)
      setLogoError('')
      setCoverFile(null)
      setCoverError('')
      setAboutFile(null)
      setAboutError('')
      toast.success('Web sitesi ayarları kaydedildi')
    } catch (err) {
      setError(err?.message || 'Web sitesi ayarları kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (nextPublished) => {
    setPublishing(true)
    setError('')
    try {
      const res = await api(nextPublished ? `/api/tenant/website/publish${websiteApiQuery}` : `/api/tenant/website/unpublish${websiteApiQuery}`, {
        method: 'POST',
        body: JSON.stringify({}),
        silent: true,
        skipBranchHeader: true,
      })
      setTenant(res?.tenant || tenant)
      setSettings(ensureWebsiteShape(res?.settings || settings, systemType))
      toast.success(nextPublished ? 'Web sitesi yayına alındı' : 'Web sitesi yayından kaldırıldı')
    } catch (err) {
      setError(err?.message || 'Yayın durumu güncellenemedi')
    } finally {
      setPublishing(false)
    }
  }

  const copyLiveUrl = async () => {
    if (!liveUrl) return
    try {
      await navigator.clipboard.writeText(liveUrl)
      toast.success('Bağlantı kopyalandı')
    } catch {
      toast.error('Bağlantı kopyalanamadı')
    }
  }

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(isStore ? '/magaza/ayarlar' : '/restoran/settings')
  }

  const openSystemMenu = () => {
    try {
      window.dispatchEvent(new Event('layout:toggle-mobile-menu'))
    } catch {}
  }

  const inputStyle = {
    minHeight: compact ? 42 : 46,
    borderRadius: 16,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    padding: '0 14px',
    fontWeight: 700,
  }

  const textareaStyle = {
    ...inputStyle,
    minHeight: compact ? 92 : 110,
    padding: 14,
    resize: 'vertical',
  }

  const cardStyle = {
    borderRadius: compact ? 20 : 28,
    border: '1px solid var(--settings-border, var(--app-border))',
    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 98%, transparent), var(--settings-panel-soft, var(--app-surface-soft)))',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
    padding: compact ? 14 : 18,
    display: 'grid',
    gap: 14,
    color: 'var(--app-text)',
  }

  if (loading) return <div className="card">Web sitesi ayarları yükleniyor...</div>

  return (
    <div
      className="settings-scope"
      style={{
        display: 'grid',
        gap: 16,
        color: 'var(--app-text)',
        '--settings-border': 'var(--app-border)',
        '--settings-panel-soft': 'color-mix(in srgb, var(--app-surface-soft) 92%, transparent)',
      }}
    >
      <section style={{ ...cardStyle, background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 9%, var(--app-surface)), color-mix(in srgb, var(--app-surface) 92%, var(--app-surface-soft)))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) auto', gap: 14, alignItems: 'start' }}>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800 }}>
            Yayın adresi: <span style={{ color: 'var(--theme-accent, var(--settings-accent-text, var(--app-text)))' }}>{livePath || (isStore ? '/wepmagaza/site-adiniz' : '/weprestorant/site-adiniz')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'stretch' : 'flex-end' }}>
            <button className="btn" type="button" onClick={load} disabled={saving || publishing}>Yenile</button>
            <button className="btn" type="button" onClick={save} disabled={saving || publishing}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            <button className="btn btn--primary" type="button" onClick={() => togglePublish(!settings.published)} disabled={saving || publishing}>
              {publishing ? 'İşleniyor...' : settings.published ? 'Yayından Kaldır' : 'Yayına Al'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : `repeat(${isStore ? 2 : 3}, minmax(0, 1fr))`, gap: 10 }}>
          <div className="card" style={{ borderColor: 'var(--settings-border, var(--app-border))', background: 'var(--app-surface)' }}><strong>Durum</strong><div style={{ marginTop: 6 }}>{settings.published ? 'Yayında' : 'Taslak'}</div></div>
          {!isStore ? <div className="card" style={{ borderColor: 'var(--settings-border, var(--app-border))', background: 'var(--app-surface)' }}><strong>QR Menü</strong><div style={{ marginTop: 6 }}>{settings.integrations?.showQrMenu ? 'Görünür' : 'Kapalı'}</div></div> : null}
          <div className="card" style={{ borderColor: 'var(--settings-border, var(--app-border))', background: 'var(--app-surface)' }}><strong>Çevrimiçi Satış</strong><div style={{ marginTop: 6 }}>{settings.integrations?.showOnlineOrder ? 'Görünür' : 'Kapalı'}</div></div>
        </div>

        {error ? <div style={{ color: '#b91c1c', fontWeight: 800 }}>{error}</div> : null}
      </section>

      <section style={{ ...cardStyle, gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800 }}>Site Adresi</span>
          <input className="input" value={settings.slug} onChange={(event) => updateTopLevel('slug', event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800 }}>Canlı Bağlantı</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" readOnly value={liveUrl} style={{ ...inputStyle, flex: '1 1 260px' }} />
            <button className="btn" type="button" onClick={copyLiveUrl} disabled={!liveUrl}>Kopyala</button>
            {liveUrl ? <a className="btn" href={liveUrl} target="_blank" rel="noreferrer">Aç</a> : null}
          </div>
        </label>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Üst Menü ve Buton Metinleri</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Hikâye Menüsü Yazısı</span>
            <input className="input" value={settings.navigation?.storyLabel || ''} onChange={(event) => updateNavigation('storyLabel', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Menü Yazısı</span>
            <input className="input" value={settings.navigation?.menuLabel || ''} onChange={(event) => updateNavigation('menuLabel', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>İletişim Menüsü Yazısı</span>
            <input className="input" value={settings.navigation?.contactLabel || ''} onChange={(event) => updateNavigation('contactLabel', event.target.value)} style={inputStyle} />
          </label>
          {!isStore ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>QR Buton Yazısı</span>
              <input className="input" value={settings.navigation?.qrButtonText || ''} onChange={(event) => updateNavigation('qrButtonText', event.target.value)} style={inputStyle} />
            </label>
          ) : null}
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Çevrimiçi Sipariş Butonu Yazısı</span>
            <input className="input" value={settings.navigation?.onlineButtonText || ''} onChange={(event) => updateNavigation('onlineButtonText', event.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Aksiyon Butonları</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {!isStore ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>QR Menü Bağlantısı</span>
              <input className="input" value={settings.integrations.qrMenuUrl} onChange={(event) => updateIntegration('qrMenuUrl', event.target.value)} style={inputStyle} placeholder={`/menu/${tenant?.slug || ''}`} />
            </label>
          ) : null}
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Çevrimiçi Satış Bağlantısı</span>
            <input
              className="input"
              value={normalizeWebsiteActionUrl(settings.integrations.onlineOrderUrl, 'online', settings.slug)}
              onChange={(event) => updateIntegration('onlineOrderUrl', event.target.value)}
              style={inputStyle}
              placeholder={isStore ? `/qr/${tenant?.slug || ''}` : `/online/${tenant?.slug || ''}`}
            />
          </label>
          {!isStore ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
              <input type="checkbox" checked={settings.integrations.showQrMenu} onChange={(event) => updateIntegration('showQrMenu', event.target.checked)} />
              QR menü butonu görünsün
            </label>
          ) : null}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
            <input type="checkbox" checked={settings.integrations.showOnlineOrder} onChange={(event) => updateIntegration('showOnlineOrder', event.target.checked)} />
            Çevrimiçi satış butonu görünsün
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Kapak Alanı ve Görseller</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Üst Küçük Yazı</span>
            <input className="input" value={settings.hero.kickerText || ''} onChange={(event) => updateHero('kickerText', event.target.value)} style={inputStyle} placeholder="Kafe · Restoran · İşletmeniz" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Daire Buton Yazısı</span>
            <input className="input" value={settings.hero.buttonText || ''} onChange={(event) => updateHero('buttonText', event.target.value)} style={inputStyle} placeholder="Menüyü Keşfet" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Başlık</span>
            <input className="input" value={settings.hero.title} onChange={(event) => updateHero('title', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Alt Başlık</span>
            <input className="input" value={settings.hero.subtitle} onChange={(event) => updateHero('subtitle', event.target.value)} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <ProductImageUploadField
            label="Logo Yükle"
            currentImageUrl={settings.hero.logoUrl}
            file={logoFile}
            onFileChange={(file, nextError) => { setLogoFile(file); setLogoError(nextError || '') }}
            onClearFile={() => { setLogoFile(null); setLogoError('') }}
            compact={compact}
            ultraCompact
            error={logoError}
            descriptionText="Üst alandaki yuvarlak marka görseli."
          />
          <ProductImageUploadField
            label="Kapak Görseli Yükle"
            currentImageUrl={settings.hero.coverImageUrl}
            file={coverFile}
            onFileChange={(file, nextError) => { setCoverFile(file); setCoverError(nextError || '') }}
            onClearFile={() => { setCoverFile(null); setCoverError('') }}
            compact={compact}
            ultraCompact
            error={coverError}
            descriptionText="Kapak alanının ana görseli."
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Manifesto ve Hakkımızda</div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Başlık</span>
              <input className="input" value={aboutSection.title} onChange={(event) => updateSectionCopy('about', 'title', event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Alt Başlık</span>
              <input className="input" value={aboutSection.subtitle} onChange={(event) => updateSectionCopy('about', 'subtitle', event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Açıklama</span>
              <textarea className="input" value={aboutSection.content} onChange={(event) => updateSectionCopy('about', 'content', event.target.value)} style={textareaStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Manifesto Metni</span>
              <textarea className="input" value={String(aboutSection.settings?.manifestoText || '')} onChange={(event) => updateSectionSettings('about', 'manifestoText', event.target.value)} style={textareaStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Manifesto Etiketi</span>
              <input className="input" value={String(aboutSection.settings?.manifestoLabel || '')} onChange={(event) => updateSectionSettings('about', 'manifestoLabel', event.target.value)} style={inputStyle} placeholder="01 / Manifesto" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Hikâye Bölümü Etiketi</span>
              <input className="input" value={String(aboutSection.settings?.sectionLabel || '')} onChange={(event) => updateSectionSettings('about', 'sectionLabel', event.target.value)} style={inputStyle} placeholder="02 / Mekan" />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Yan Görsel</div>
            <ProductImageUploadField
              label="Mekân / Hikâye Görseli"
              currentImageUrl={String(aboutSection.settings?.imageUrl || '')}
              file={aboutFile}
              onFileChange={(file, nextError) => { setAboutFile(file); setAboutError(nextError || '') }}
              onClearFile={() => { setAboutFile(null); setAboutError('') }}
              compact={compact}
              ultraCompact
              error={aboutError}
              descriptionText="Hakkımızda bölümündeki büyük yatay veya dikey görsel."
            />
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Galeri Metinleri</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Galeri Etiketi</span>
            <input className="input" value={String(productsSection.settings?.galleryLabel || '')} onChange={(event) => updateSectionSettings('products', 'galleryLabel', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Galeri Başlığı</span>
            <input className="input" value={String(productsSection.settings?.galleryTitle || '')} onChange={(event) => updateSectionSettings('products', 'galleryTitle', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: compact ? 'auto' : '1 / -1' }}>
            <span>Galeri Açıklaması</span>
            <textarea className="input" value={String(productsSection.settings?.galleryDescription || '')} onChange={(event) => updateSectionSettings('products', 'galleryDescription', event.target.value)} style={textareaStyle} />
          </label>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 900 }}>Galeri Görselleri</div>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Web sitesi galerisinde kayan detay fotoğrafları.</div>
            </div>
            <button className="btn" type="button" onClick={addGalleryItem}>+ Görsel Ekle</button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {(settings.hero.galleryImages || []).map((item) => (
              <div key={item.id} style={{ borderRadius: 16, border: '1px solid var(--settings-border, var(--app-border))', padding: 8, background: 'var(--app-surface)', display: 'grid', gap: 6, alignContent: 'start' }}>
                <ProductImageUploadField
                  label="Galeri"
                  currentImageUrl={item.url}
                  file={item.file}
                  onFileChange={(file, nextError) => setGalleryFile(item.id, file, nextError)}
                  onClearFile={() => setGalleryFile(item.id, null, '')}
                  compact
                  ultraCompact
                  error={item.error}
                  helperText="Maks. 5 MB"
                  descriptionText="Detay görseli"
                />
                <button className="btn" type="button" onClick={() => removeGalleryItem(item.id)}>Sil</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Ürün Vitrini</div>
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Ürün ekledikçe menüdeki ürünler seçilir ve web sitesi kartlarında gösterilir.</div>
          </div>
          <button className="btn" type="button" onClick={addFeaturedProduct} disabled={!products.length}>+ Ürün Ekle</button>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Bölüm Başlığı</span>
          <input className="input" value={productsSection.title} onChange={(event) => updateSectionCopy('products', 'title', event.target.value)} style={inputStyle} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Bölüm Açıklaması</span>
          <input className="input" value={productsSection.subtitle} onChange={(event) => updateSectionCopy('products', 'subtitle', event.target.value)} style={inputStyle} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Varsayılan Ürün Açıklaması</span>
            <input className="input" value={String(productsSection.settings?.productFallbackDescription || '')} onChange={(event) => updateSectionSettings('products', 'productFallbackDescription', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Görsel Yok Yazısı</span>
            <input className="input" value={String(productsSection.settings?.imageFallbackText || '')} onChange={(event) => updateSectionSettings('products', 'imageFallbackText', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Ürün Bulunamadığında Gösterilecek Mesaj</span>
            <input className="input" value={String(productsSection.settings?.emptyStateText || '')} onChange={(event) => updateSectionSettings('products', 'emptyStateText', event.target.value)} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {featuredIds.length === 0 ? (
            <div style={{ borderRadius: 16, border: '1px dashed var(--app-border)', padding: 14, color: 'var(--app-text-secondary, var(--muted))' }}>
              Henüz ürün vitrini seçilmedi.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {featuredIds.map((id, index) => {
                const item = products.find((product) => getProductId(product) === String(id))
                const isEditing = editingFeaturedIndex === index
                return (
                  <div
                    key={`${id}-${index}`}
                    className="card"
                    onClick={() => setEditingFeaturedIndex(isEditing ? null : index)}
                    style={{
                      minWidth: 0,
                      cursor: 'pointer',
                      borderColor: isEditing ? 'var(--theme-accent, var(--app-border))' : undefined,
                      boxShadow: isEditing ? '0 0 0 1px var(--theme-accent, var(--app-border)) inset' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900 }}>{item?.name || 'Ürün seçilmedi'}</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>
                          {item?.description || 'Açıklama yok'}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-text-secondary, var(--muted))', whiteSpace: 'nowrap' }}>
                        {isEditing ? 'Düzenleme açık' : 'Düzenle'}
                      </div>
                    </div>

                    {isEditing ? (
                      <div
                        style={{ display: 'grid', gap: 8, marginTop: 12 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <select value={id} onChange={(event) => updateFeaturedProduct(index, event.target.value)} style={{ ...inputStyle, width: '100%' }}>
                          {products.map((product) => {
                            const itemId = getProductId(product)
                            return <option key={itemId} value={itemId}>{product.name}</option>
                          })}
                        </select>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn" type="button" onClick={() => setEditingFeaturedIndex(null)}>Kapat</button>
                          <button className="btn" type="button" onClick={() => removeFeaturedProduct(index)}>Sil</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>İletişim, Alıntı ve SEO</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Adres Başlığı</span>
            <input className="input" value={String(contactSection.settings?.addressLabel || '')} onChange={(event) => updateSectionSettings('contact', 'addressLabel', event.target.value)} style={inputStyle} placeholder="Adres" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Rezervasyon Başlığı</span>
            <input className="input" value={String(contactSection.settings?.reservationLabel || '')} onChange={(event) => updateSectionSettings('contact', 'reservationLabel', event.target.value)} style={inputStyle} placeholder="Rezervasyon" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Adres Boşken Gösterilecek Metin</span>
            <input className="input" value={String(contactSection.settings?.emptyAddressText || '')} onChange={(event) => updateSectionSettings('contact', 'emptyAddressText', event.target.value)} style={inputStyle} placeholder="Adres bilgisi eklenmedi" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Rezervasyon Boşken Gösterilecek Metin</span>
            <input className="input" value={String(contactSection.settings?.emptyReservationText || '')} onChange={(event) => updateSectionSettings('contact', 'emptyReservationText', event.target.value)} style={inputStyle} placeholder="İletişim bilgisi eklenmedi" />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: compact ? 'auto' : '1 / -1' }}>
            <span>Alıntı Metni</span>
            <textarea className="input" value={String(contactSection.settings?.quoteText || '')} onChange={(event) => updateSectionSettings('contact', 'quoteText', event.target.value)} style={textareaStyle} placeholder="İyi yemek acele etmez. Ama iyi sipariş hızlı olmalıdır." />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Alıntı İmzası</span>
            <input className="input" value={String(contactSection.settings?.quoteAuthor || '')} onChange={(event) => updateSectionSettings('contact', 'quoteAuthor', event.target.value)} style={inputStyle} placeholder="Restoran Felsefesi" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Harita Bağlantısı Metni</span>
            <input className="input" value={String(contactSection.settings?.mapLinkText || '')} onChange={(event) => updateSectionSettings('contact', 'mapLinkText', event.target.value)} style={inputStyle} placeholder="Haritada Aç" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Telefon</span>
            <input className="input" value={settings.contact.phone} onChange={(event) => updateContact('phone', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>WhatsApp</span>
            <input className="input" value={settings.contact.whatsapp} onChange={(event) => updateContact('whatsapp', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>E-posta</span>
            <input className="input" value={settings.contact.email} onChange={(event) => updateContact('email', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Harita Bağlantısı</span>
            <input className="input" value={settings.contact.mapUrl} onChange={(event) => updateContact('mapUrl', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: compact ? 'auto' : '1 / -1' }}>
            <span>Adres</span>
            <textarea className="input" value={settings.contact.address} onChange={(event) => updateContact('address', event.target.value)} style={textareaStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>SEO Başlığı</span>
            <input className="input" value={settings.seo.title} onChange={(event) => updateSeo('title', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>SEO Açıklaması</span>
            <input className="input" value={settings.seo.description} onChange={(event) => updateSeo('description', event.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>
    </div>
  )
}
