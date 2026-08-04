import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { resolveProductImageUrl } from '../lib/productImage.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

const currency = (value) => new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

function getProductId(item) {
  return String(item?.id || item?._id || item?.productId || '').trim()
}

function resolveWebsiteImageUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return resolveProductImageUrl({ imageUrl: raw })
}

function buildCategoryKey(value) {
  const raw = String(value || '').trim().toLocaleLowerCase('tr-TR')
  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isStoreWebsiteSystem(systemType) {
  const normalized = String(systemType || '').trim().toLocaleLowerCase('tr-TR')
  return normalized === 'canteen' || normalized === 'kantin'
}

function normalizeWebsiteData(payload) {
  const settings = payload?.settings || {}
  const data = payload?.data || {}
  const rawProducts = Array.isArray(data.items) ? data.items : []
  const rawCategories = Array.isArray(data.categories) ? data.categories : []
  const products = rawProducts
    .map((item) => ({
      ...item,
      id: getProductId(item),
      categoryName: String(item?.categoryName || 'Secili Lezzet').trim() || 'Secili Lezzet',
    }))
    .filter((item) => item.id)

  const sections = Array.isArray(settings.sections) ? settings.sections : []
  const sectionMap = new Map(sections.map((section) => [String(section?.type || ''), section]))
  const productsSection = sectionMap.get('products') || {}
  const aboutSection = sectionMap.get('about') || {}
  const contactSection = sectionMap.get('contact') || {}
  const featuredIds = Array.isArray(productsSection?.settings?.featuredProductIds) ? productsSection.settings.featuredProductIds : []
  const featuredProducts = featuredIds
    .map((id) => products.find((item) => getProductId(item) === String(id)))
    .filter(Boolean)
  const menuProducts = featuredProducts
  const categoriesFromProducts = Array.from(new Map(
    menuProducts
      .map((item) => {
        const name = String(item?.categoryName || '').trim()
        if (!name) return null
        return [buildCategoryKey(name), { key: buildCategoryKey(name), name }]
      })
      .filter(Boolean)
  ).values())
  const categories = rawCategories.length > 0
    ? rawCategories
        .map((item) => {
          const name = String(item?.name || '').trim()
          if (!name) return null
          return {
            key: buildCategoryKey(name),
            name,
          }
        })
        .filter(Boolean)
    : categoriesFromProducts

  const gallery = Array.isArray(settings?.hero?.galleryImages)
    ? settings.hero.galleryImages.map((item) => String(item?.url || item || '').trim()).filter(Boolean)
    : []

  return {
    tenant: payload?.tenant || {},
    settings,
    menuProducts,
    categories,
    gallery,
    aboutSection,
    productsSection,
    contactSection,
  }
}

function ProductThumb({ product, fallbackLabel, emptyText }) {
  const imageUrl = resolveWebsiteImageUrl(product?.imageUrl)
  if (imageUrl) {
    return <img src={imageUrl} alt={product?.name || fallbackLabel} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#d1d5db', color: 'rgba(17,24,39,0.45)', fontFamily: 'Arial, sans-serif', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      {emptyText || 'Gorsel Yok'}
    </div>
  )
}

export default function RestaurantWebsitePage({ siteType = 'auto' }) {
  const { slug } = useParams()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const query = siteType && siteType !== 'auto' ? `?siteType=${encodeURIComponent(siteType)}` : ''
        const res = await api(`/api/public/sites/${slug}${query}`, {
          silent: true,
          skipBranchHeader: true,
          cacheMode: 'no-store',
        })
        if (!mounted) return
        setPayload(res)
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Web sitesi acilamadi')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [slug])

  const site = useMemo(() => normalizeWebsiteData(payload || {}), [payload])
  const compact = isMobilePortrait || isTablet
  const isPhone = isMobilePortrait
  const theme = site.settings?.theme || {}
  const hero = site.settings?.hero || {}
  const navigation = site.settings?.navigation || {}
  const contact = site.settings?.contact || {}
  const integrations = site.settings?.integrations || {}
  const isStore = isStoreWebsiteSystem(site.tenant?.systemType)
  const requestedStoreView = siteType === 'store'
  const requestedRestaurantView = siteType === 'restaurant'
  const siteTypeMismatch = Boolean(
    payload && (
      (requestedStoreView && !isStore)
      || (requestedRestaurantView && isStore)
    )
  )
  const siteUnavailable = Boolean(
    payload && (
      site.settings?.enabled === false
      || site.settings?.published !== true
    )
  )
  const tenantName = String(site.tenant?.name || (isStore ? 'Magaza' : 'Restoran'))
  const qrMenuUrl = integrations?.qrMenuUrl || (isStore ? '' : `/menu/${site.tenant?.slug || slug}`)
  const onlineOrderUrl = integrations?.onlineOrderUrl || (isStore ? `/qr/${site.tenant?.slug || slug}` : `/online/${site.tenant?.slug || slug}`)
  const seoTitle = site.settings?.seo?.title || tenantName
  const resolvedLogoUrl = resolveWebsiteImageUrl(hero.logoUrl || site.tenant?.logoUrl)
  const resolvedHeroGallery = (hero.coverImageUrl ? [hero.coverImageUrl, ...site.gallery] : site.gallery)
    .map((imageUrl) => resolveWebsiteImageUrl(imageUrl))
    .filter(Boolean)
  const resolvedHeroImage = resolvedHeroGallery[0] || resolveWebsiteImageUrl(site.aboutSection?.settings?.imageUrl)
  const resolvedAboutImageUrl = resolveWebsiteImageUrl(site.aboutSection?.settings?.imageUrl) || resolvedHeroGallery[1] || resolvedHeroImage
  const gallerySectionImages = resolvedHeroGallery.slice(1)
  const featuredProducts = site.menuProducts

  const rootBg = '#d1d5db'
  const pageSurface = '#e5e7eb'
  const softSurface = '#f3f4f6'
  const panel = 'rgba(255,255,255,0.76)'
  const textColor = '#111827'
  const strongText = '#030712'
  const muted = 'rgba(17,24,39,0.68)'
  const subtle = 'rgba(17,24,39,0.48)'
  const line = 'rgba(17,24,39,0.14)'
  const accent = String(theme.secondaryColor || '#9ca3af').trim() || '#9ca3af'
  const accentSoft = 'rgba(156,163,175,0.18)'
  const accentStrong = '#6b7280'
  const buttonBg = '#111827'
  const buttonText = '#f9fafb'
  const quoteText = String(site.contactSection?.settings?.quoteText || site.contactSection?.subtitle || site.aboutSection?.subtitle || hero.subtitle || 'Iyi yemek acele etmez. Ama iyi siparis hizli olmalidir.')
  const quoteAuthor = String(site.contactSection?.settings?.quoteAuthor || `${tenantName} Kitchen Philosophy`)
  const statementText = String(site.aboutSection?.settings?.manifestoText || site.aboutSection?.subtitle || 'Her tabak bir recete degil, bir karakter tasir.')
  const footerAddress = contact.address || String(site.contactSection?.settings?.emptyAddressText || 'Adres bilgisi eklenmedi')
  const footerReservation = [contact.phone || null, contact.email || null].filter(Boolean).join('\n') || String(site.contactSection?.settings?.emptyReservationText || 'Iletisim bilgisi eklenmedi')
  const storyLabel = String(navigation.storyLabel || 'Hikaye')
  const menuLabel = String(navigation.menuLabel || 'Menu')
  const contactLabel = String(navigation.contactLabel || 'Iletisim')
  const qrButtonText = String(navigation.qrButtonText || 'QR Menu')
  const heroKickerText = String(hero.kickerText || `Cafe · Restoran · ${tenantName}`)
  const heroCircleText = String(hero.buttonText || (isStore ? 'Online Siparisi Ac' : 'Menuyu Kesfet'))
  const footerAddressLabel = String(site.contactSection?.settings?.addressLabel || 'Adres')
  const footerReservationLabel = String(site.contactSection?.settings?.reservationLabel || 'Rezervasyon')
  const onlineButtonText = String(navigation.onlineButtonText || 'Online Siparis')
  const aboutSectionLabel = String(site.aboutSection?.settings?.sectionLabel || '02 / Mekan')
  const mapLinkText = String(site.contactSection?.settings?.mapLinkText || 'Haritada Ac')
  const imageFallbackText = String(site.productsSection?.settings?.imageFallbackText || 'Gorsel Yok')
  const showOnlineOrderButton = integrations.showOnlineOrder === true
  const showHeroPrimaryCta = isStore ? showOnlineOrderButton : true

  useEffect(() => {
    document.title = seoTitle ? `${seoTitle} | PenPOS` : 'PenPOS'
  }, [seoTitle])
  const checkoutHref = onlineOrderUrl || qrMenuUrl || '#menu'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: rootBg, color: textColor }}>
        Web sitesi yukleniyor...
      </div>
    )
  }

  if (error || !payload || siteTypeMismatch || siteUnavailable) {
    const title = (siteTypeMismatch || siteUnavailable) ? '404' : 'Bu sayfaya ulasilamiyor'
    const message = siteTypeMismatch
      ? 'Bu yayin adresi farkli bir sistem tipine ait oldugu icin acilamadi.'
      : siteUnavailable
        ? 'Bu web sitesi su anda yayinda degil.'
      : (error || 'Kayit bulunamadi')
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #d1d5db, #f3f4f6)', color: textColor, padding: 24 }}>
        <div
          style={{
            width: 'min(680px, 100%)',
            borderRadius: 32,
            border: `1px solid ${line}`,
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 28px 80px rgba(15, 23, 42, 0.12)',
            padding: compact ? 28 : 40,
            textAlign: 'center',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: subtle }}>
            PenPOS Public Website
          </div>
          <div style={{ marginTop: 14, fontSize: compact ? 56 : 88, lineHeight: 0.95, fontWeight: 500, letterSpacing: '-0.06em', color: strongText }}>
            {title}
          </div>
          <div style={{ marginTop: 18, fontSize: compact ? 20 : 28, fontWeight: 700, letterSpacing: '-0.04em', color: strongText }}>
            Bu sayfaya ulasilamiyor
          </div>
          <div style={{ marginTop: 12, color: muted, fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1.7 }}>
            {message}
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn" to="/">Ana Sayfaya Don</Link>
            <button className="btn" type="button" onClick={() => window.location.reload()}>
              Sayfayi Yenile
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: rootBg, color: textColor, minHeight: '100vh', fontFamily: theme.fontFamily || 'Georgia, "Times New Roman", serif' }}>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          minHeight: compact ? 112 : 82,
          zIndex: 40,
          display: 'flex',
          alignItems: compact ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexDirection: compact ? 'column' : 'row',
          padding: compact ? '14px 16px 12px' : '0 34px',
          background: 'linear-gradient(to bottom, rgba(229,231,235,0.96), rgba(229,231,235,0.74), transparent)',
          borderBottom: `1px solid ${line}`,
          backdropFilter: 'blur(12px)',
          gap: compact ? 10 : 16,
        }}
      >
        {compact ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
              <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 12, color: strongText, textDecoration: 'none', minWidth: 0 }}>
                {resolvedLogoUrl ? <img src={resolvedLogoUrl} alt={`${tenantName} logo`} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${line}` }} /> : null}
                <span style={{ fontSize: 18, letterSpacing: '0.16em', fontWeight: 700 }}>{tenantName.toUpperCase()}</span>
              </a>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!isStore && integrations.showQrMenu ? (
                  <a href={qrMenuUrl} style={{ border: `1px solid ${line}`, background: 'rgba(255,255,255,0.62)', color: textColor, padding: '10px 12px', fontFamily: 'Arial, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none' }}>
                    {qrButtonText}
                  </a>
                ) : null}
                {showOnlineOrderButton ? (
                  <a
                    href={checkoutHref}
                    style={{ border: `1px solid ${buttonBg}`, background: buttonBg, color: buttonText, padding: '10px 12px', fontFamily: 'Arial, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none', fontWeight: 800 }}
                  >
                    {onlineButtonText}
                  </a>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 18, fontFamily: 'Arial, sans-serif', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.16em', color: strongText, flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%' }}>
              <a href="#story" style={{ color: strongText, textDecoration: 'none' }}>{storyLabel}</a>
              <a href="#menu" style={{ color: strongText, textDecoration: 'none' }}>{menuLabel}</a>
              <a href="#contact" style={{ color: strongText, textDecoration: 'none' }}>{contactLabel}</a>
            </div>
          </>
        ) : (
          <>
            <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 12, color: strongText, textDecoration: 'none', minWidth: 0 }}>
              {resolvedLogoUrl ? <img src={resolvedLogoUrl} alt={`${tenantName} logo`} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${line}` }} /> : null}
              <span style={{ fontSize: 28, letterSpacing: '0.22em', fontWeight: 700 }}>{tenantName.toUpperCase()}</span>
            </a>
            <div style={{ display: 'flex', gap: 28, fontFamily: 'Arial, sans-serif', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.16em', color: strongText, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="#story" style={{ color: strongText, textDecoration: 'none' }}>{storyLabel}</a>
              <a href="#menu" style={{ color: strongText, textDecoration: 'none' }}>{menuLabel}</a>
              <a href="#contact" style={{ color: strongText, textDecoration: 'none' }}>{contactLabel}</a>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isStore && integrations.showQrMenu ? (
                <a href={qrMenuUrl} style={{ border: `1px solid ${line}`, background: 'rgba(255,255,255,0.62)', color: textColor, padding: '12px 16px', fontFamily: 'Arial, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none' }}>
                  {qrButtonText}
                </a>
              ) : null}
              {showOnlineOrderButton ? (
                <a
                  href={checkoutHref}
                  style={{ border: `1px solid ${buttonBg}`, background: buttonBg, color: buttonText, padding: '12px 16px', fontFamily: 'Arial, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none', fontWeight: 800 }}
                >
                  {onlineButtonText}
                </a>
              ) : null}
            </div>
          </>
        )}
      </nav>

      <header
        id="top"
        style={{
          minHeight: compact ? 'auto' : '100vh',
          position: 'relative',
          display: 'grid',
          placeItems: 'end start',
          overflow: 'hidden',
          borderBottom: `1px solid ${line}`,
          paddingTop: compact ? 134 : 0,
          background: resolvedHeroImage
            ? `linear-gradient(90deg, rgba(249,250,251,0.82) 0%, rgba(249,250,251,0.62) 46%, rgba(249,250,251,0.16) 100%), url(${resolvedHeroImage}) center/cover`
            : `linear-gradient(135deg, ${softSurface}, ${pageSurface})`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, rgba(209,213,219,0.72), transparent 28%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2, width: compact ? 'calc(100% - 32px)' : 'min(850px, calc(100% - 48px))', margin: compact ? '0 16px 28px' : '0 0 90px 6vw' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: compact ? '0.18em' : '0.3em', fontSize: 11, color: strongText, marginBottom: compact ? 14 : 20 }}>
            {heroKickerText}
          </div>
          <h1 style={{ margin: 0, fontSize: compact ? 'clamp(44px, 16vw, 72px)' : 'clamp(72px, 11vw, 170px)', lineHeight: compact ? 0.9 : 0.78, fontWeight: 400, letterSpacing: compact ? '-0.05em' : '-0.07em', whiteSpace: 'pre-line', color: strongText, maxWidth: compact ? '100%' : undefined }}>
            {String(hero.title || tenantName).replace(/\\n/g, '\n')}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr auto', alignItems: compact ? 'start' : 'end', gap: compact ? 18 : 32, marginTop: compact ? 18 : 30, maxWidth: 760 }}>
            <p style={{ margin: 0, color: muted, fontFamily: 'Arial, sans-serif', fontSize: compact ? 14 : 16, lineHeight: 1.7, maxWidth: 540 }}>
              {hero.subtitle || (isStore ? 'Yeni sezon urunleri, kampanyalari ve online siparis akisiniz tek vitrinde toplansin.' : 'Atesin, dokunun ve mevsimsel urunlerin bir araya geldigi cagdas bir restoran deneyimi. Masadan QR menuye, evden online siparise tek akis.')}
            </p>
            {showHeroPrimaryCta ? (
              <a
                href={isStore ? checkoutHref : '#menu'}
                style={{
                  width: compact ? 90 : 112,
                  height: compact ? 90 : 112,
                  borderRadius: '50%',
                  border: `1px solid ${line}`,
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: strongText,
                  textDecoration: 'none',
                  background: 'rgba(255,255,255,0.56)',
                  justifySelf: compact ? 'start' : 'auto',
                }}
              >
                {heroCircleText}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section id="story" style={{ padding: compact ? '64px 16px' : '110px 5vw', background: rootBg }}>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '220px 1fr', gap: compact ? 18 : 50 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 11, color: accentStrong, paddingTop: compact ? 0 : 10 }}>{String(site.aboutSection?.settings?.manifestoLabel || '01 / Manifesto')}</div>
          <p style={{ fontSize: compact ? 'clamp(36px, 14vw, 56px)' : 'clamp(44px, 6vw, 90px)', lineHeight: compact ? 0.96 : 0.98, maxWidth: 1050, margin: 0, fontWeight: 400, color: strongText, wordBreak: 'break-word' }}>
            {statementText}
          </p>
        </div>
      </section>

      {gallerySectionImages.length > 0 ? (
        <section style={{ padding: compact ? '0 16px 64px' : '0 5vw 110px', background: rootBg }}>
          <style>{`
            @keyframes website-gallery-marquee {
              from { transform: translate3d(0, 0, 0); }
              to { transform: translate3d(-50%, 0, 0); }
            }
          `}</style>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 11, color: accentStrong }}>{String(site.productsSection?.settings?.galleryLabel || 'Galeri')}</div>
                <h2 style={{ margin: '10px 0 0', fontSize: compact ? 'clamp(28px, 10vw, 42px)' : 'clamp(34px, 5vw, 64px)', lineHeight: 0.94, fontWeight: 400, color: strongText }}>
                  {String(site.productsSection?.settings?.galleryTitle || 'Mekan ve detay fotograflari')}
                </h2>
              </div>
              <div style={{ fontFamily: 'Arial, sans-serif', color: muted, fontSize: 13, maxWidth: compact ? '100%' : 360 }}>
                {String(site.productsSection?.settings?.galleryDescription || 'Ayarlardan yukledigin galeri gorselleri burada gosterilir.')}
              </div>
            </div>

            <div style={{ overflow: 'hidden', padding: '4px 0' }}>
              {gallerySectionImages.length > 1 ? (
                <div
                  style={{
                    display: 'flex',
                    width: 'max-content',
                    animation: `website-gallery-marquee ${compact ? 18 : 28}s linear infinite`,
                    willChange: 'transform',
                    transform: 'translate3d(0, 0, 0)',
                  }}
                >
                  {[0, 1].map((groupIndex) => (
                    <div key={groupIndex} style={{ display: 'flex', gap: compact ? 10 : 14, paddingRight: compact ? 10 : 14 }}>
                      {gallerySectionImages.map((imageUrl, index) => (
                        <div
                          key={`${groupIndex}-${imageUrl}-${index}`}
                          style={{
                            width: compact ? '160px' : 'clamp(180px, 18vw, 260px)',
                            height: compact ? '118px' : 'clamp(140px, 15vw, 190px)',
                            flex: '0 0 auto',
                            borderRadius: compact ? 18 : 22,
                            overflow: 'hidden',
                            border: `1px solid ${line}`,
                            background: pageSurface,
                            boxShadow: '0 12px 24px rgba(17,24,39,0.05)',
                          }}
                        >
                          <img src={imageUrl} alt={`${tenantName} galeri ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: compact ? 10 : 14 }}>
                  {gallerySectionImages.map((imageUrl, index) => (
                    <div
                      key={`${imageUrl}-${index}`}
                      style={{
                        width: compact ? '160px' : 'clamp(180px, 18vw, 260px)',
                        height: compact ? '118px' : 'clamp(140px, 15vw, 190px)',
                        flex: '0 0 auto',
                        borderRadius: compact ? 18 : 22,
                        overflow: 'hidden',
                        border: `1px solid ${line}`,
                        background: pageSurface,
                        boxShadow: '0 12px 24px rgba(17,24,39,0.05)',
                      }}
                    >
                      <img src={imageUrl} alt={`${tenantName} galeri ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', minHeight: compact ? 'auto' : 680, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, background: softSurface }}>
        <div
          style={{
            minHeight: compact ? 240 : 460,
            background: resolvedAboutImageUrl
              ? `url(${resolvedAboutImageUrl}) center/cover`
              : `linear-gradient(135deg, ${accentSoft}, ${pageSurface})`,
          }}
        />
        <div style={{ padding: compact ? 24 : 70, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: panel }}>
          <div style={{ fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 11, color: accentStrong, paddingTop: 10 }}>{aboutSectionLabel}</div>
          <h2 style={{ fontSize: compact ? 'clamp(34px, 11vw, 52px)' : 'clamp(50px, 6vw, 92px)', lineHeight: 0.9, fontWeight: 400, margin: '0 0 28px', letterSpacing: '-0.05em', whiteSpace: 'pre-line', color: strongText }}>
            {String(site.aboutSection?.title || 'Geceye\nuzanan masa.').replace(/\\n/g, '\n')}
          </h2>
          <div style={{ fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12, color: accentStrong, marginBottom: 16 }}>
            {String(site.aboutSection?.subtitle || 'Mekanin kisa ozeti')}
          </div>
          <p style={{ fontFamily: 'Arial, sans-serif', color: muted, lineHeight: 1.8, fontSize: 15, maxWidth: 560 }}>
            {site.aboutSection?.content || 'Bu alan isletmenin hikayesini, sefini veya mekan konseptini anlatmak icin kullanilabilir.'}
          </p>
        </div>
      </section>

      <section id="menu" style={{ padding: compact ? '64px 16px' : '110px 5vw', background: rootBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 30, alignItems: 'end', marginBottom: 40, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: compact ? 'clamp(36px, 12vw, 54px)' : 'clamp(58px, 8vw, 120px)', lineHeight: 0.9, fontWeight: 400, letterSpacing: '-0.07em', whiteSpace: 'pre-line', color: strongText }}>
            {String(site.productsSection?.title || 'Selected\nMenu').replace(/\\n/g, '\n')}
          </h2>
          <p style={{ fontFamily: 'Arial, sans-serif', color: muted, maxWidth: 420, lineHeight: 1.7, margin: 0 }}>
            {site.productsSection?.subtitle || (isStore ? 'Online siparis ekraninda yayinlanan urunler burada vitrin kartlari halinde gosterilir.' : 'QR menuden secilen urunler aninda sepete eklenir. Kategori filtreleriyle urunler hizlica bulunur.')}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(220px, 280px))', gap: 16, justifyContent: 'space-between' }}>
          {featuredProducts.map((product) => (
            <article
              key={product.id}
              style={{
                border: `1px solid ${line}`,
                borderRadius: 20,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.56)',
                boxShadow: '0 14px 28px rgba(17,24,39,0.05)',
              }}
            >
              <div style={{ width: '100%', aspectRatio: '4 / 2.45', overflow: 'hidden', background: pageSurface }}>
                <ProductThumb product={product} fallbackLabel={product.name} emptyText={imageFallbackText} />
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                  <div style={{ fontSize: 16, lineHeight: 1.15, color: strongText }}>{product.name}</div>
                  <div style={{ color: strongText, fontSize: 15, whiteSpace: 'nowrap', fontWeight: 700 }}>{currency(product.price)}</div>
                </div>
                <div style={{ marginTop: 10, fontFamily: 'Arial, sans-serif', color: muted, fontSize: 12, lineHeight: 1.55 }}>
                  {product.description || String(site.productsSection?.settings?.productFallbackDescription || 'Aciklama yakinda eklenecek.')}
                </div>
              </div>
            </article>
          ))}
          {featuredProducts.length === 0 ? (
            <div style={{ padding: '24px 0', color: muted, fontFamily: 'Arial, sans-serif' }}>
              {String(site.productsSection?.settings?.emptyStateText || 'Gosterilecek one cikan urun bulunamadi.')}
            </div>
          ) : null}
        </div>
      </section>

      <section
        style={{
          minHeight: compact ? 380 : 620,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: compact ? '56px 16px' : '80px 20px',
          background: resolvedHeroGallery[1]
            ? `linear-gradient(rgba(243,244,246,0.9), rgba(229,231,235,0.84)), url(${resolvedHeroGallery[1]}) center/cover`
            : `linear-gradient(135deg, ${softSurface}, ${pageSurface})`,
          borderTop: `1px solid ${line}`,
          borderBottom: `1px solid ${line}`,
        }}
      >
        <blockquote style={{ maxWidth: 900, margin: 0, fontSize: compact ? 'clamp(28px, 10vw, 44px)' : 'clamp(44px, 6vw, 88px)', lineHeight: 1, fontStyle: 'italic', color: strongText }}>
          "{quoteText}"
          <small style={{ display: 'block', marginTop: 28, fontFamily: 'Arial, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: accentStrong }}>
            {quoteAuthor}
          </small>
        </blockquote>
      </section>

      <footer id="contact" style={{ padding: compact ? '44px 16px 28px' : '60px 5vw 30px', display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.2fr 1fr 1fr', gap: compact ? 24 : 40, borderTop: `1px solid ${line}`, background: softSurface }}>
        <div style={{ fontSize: compact ? 34 : 56, letterSpacing: '0.14em', color: strongText }}>{tenantName.toUpperCase()}</div>
        <div style={{ fontFamily: 'Arial, sans-serif', color: muted, lineHeight: 1.8, fontSize: 13, whiteSpace: 'pre-line' }}>
          <strong style={{ display: 'block', color: strongText, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11 }}>{footerAddressLabel}</strong>
          {footerAddress}
        </div>
        <div style={{ fontFamily: 'Arial, sans-serif', color: muted, lineHeight: 1.8, fontSize: 13, whiteSpace: 'pre-line' }}>
          <strong style={{ display: 'block', color: strongText, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11 }}>{footerReservationLabel}</strong>
          {footerReservation}
          {contact.mapUrl ? (
            <>
              {'\n'}
              <a href={contact.mapUrl} target="_blank" rel="noreferrer" style={{ color: accentStrong }}>{mapLinkText}</a>
            </>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
